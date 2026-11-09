from datetime import date,datetime,timedelta
from flask import abort,request,session,redirect,url_for
from app import app
from config import get_connection
from models.decorators import role_required
from models.pdf_export import pdf_response,money

@app.route('/customer/reservations/<int:reservation_id>/pdf')
@role_required('customer')
def customer_reservation_pdf(reservation_id):
    connection=get_connection();cursor=connection.cursor(dictionary=True)
    try:
        cursor.execute('''SELECT r.*,res.resort_name,res.address,a.fullname,a.email,c.phone,
            (SELECT COALESCE(SUM(p.amount_paid),0) FROM payments p
             WHERE p.reservation_id=r.reservation_id AND p.payment_status='Verified') AS verified_paid
            FROM reservations r JOIN resorts res ON res.resort_id=r.resort_id
            JOIN customers c ON c.customer_id=r.customer_id JOIN accounts a ON a.account_id=c.account_id
            WHERE r.reservation_id=%s AND c.account_id=%s''',(reservation_id,session['account_id']))
        row=cursor.fetchone()
        if not row:abort(404)
        def stamp(v):return v.strftime('%b %d, %Y %I:%M %p') if isinstance(v,datetime) else str(v or 'Not specified')
        fields=[('Reservation','RSV-'+str(reservation_id)),('Status',row['reservation_status']),('Customer',row['fullname']),('Email',row['email']),('Phone',row.get('phone')),('Resort',row['resort_name']),('Address',row.get('address')),('Check-in',stamp(row.get('start_at') or row.get('check_in'))),('Check-out',stamp(row.get('end_at') or row.get('check_out'))),('Tour type',row.get('tour_type') or 'Not specified'),('Guests',row['guests']),('Booked on',stamp(row.get('created_at'))),('Reservation total',money(row['total_amount'])),('Verified payments',money(row['verified_paid'])),('Remaining balance',money(max(float(row['total_amount'] or 0)-float(row['verified_paid'] or 0),0)))]
        return pdf_response(f'reservation-RSV-{reservation_id}.pdf','Reservation Details','Generated '+datetime.now().strftime('%b %d, %Y %I:%M %p'),['Detail','Information'],fields,[145,386],notes=['This document records your reservation details. A pending or rejected reservation is not a confirmed booking. Only verified payments are included in the paid amount.'])
    finally:cursor.close();connection.close()

@app.route('/reports/pdf')
@role_required('owner')
def reports_pdf():
    month=request.args.get('month',date.today().strftime('%Y-%m'))
    try:
        first=datetime.strptime(month,'%Y-%m').date().replace(day=1)
        if first.strftime('%Y-%m')!=month:raise ValueError
    except (TypeError,ValueError):abort(400,'Choose a valid report month.')
    end=(first.replace(day=28)+timedelta(days=4)).replace(day=1)
    resort=request.args.get('resort_id','')
    try:rid=int(resort) if resort else None
    except ValueError:abort(400,'Choose a valid resort.')
    connection=get_connection();cursor=connection.cursor(dictionary=True)
    try:
        cursor.execute('SELECT resort_id,resort_name FROM resorts '+('WHERE resort_id=%s ' if rid else '')+'ORDER BY resort_name',(rid,) if rid else ())
        resorts=cursor.fetchall()
        if rid and not resorts:abort(404)
        rows=[];totals=[0,0.0]
        for item in resorts:
            cursor.execute('SELECT COUNT(*) AS bookings FROM reservations WHERE resort_id=%s AND created_at >= %s AND created_at < %s',(item['resort_id'],first,end));count=int(cursor.fetchone()['bookings'] or 0)
            cursor.execute("SELECT COALESCE(SUM(p.amount_paid),0) AS revenue FROM payments p JOIN reservations r ON r.reservation_id=p.reservation_id WHERE r.resort_id=%s AND p.payment_status='Verified' AND p.payment_date >= %s AND p.payment_date < %s",(item['resort_id'],first,end));revenue=float(cursor.fetchone()['revenue'] or 0)
            cursor.execute('SELECT AVG(rating) AS rating FROM reviews WHERE resort_id=%s AND review_date >= %s AND review_date < %s',(item['resort_id'],first,end));rating=cursor.fetchone()['rating']
            rows.append([first.strftime('%b %Y'),count,money(revenue),money(revenue/count) if count else 'N/A',f'{float(rating):.1f} / 5' if rating is not None else 'No ratings',item['resort_name']]);totals[0]+=count;totals[1]+=revenue
        return pdf_response('resort-report-'+month+'.pdf','Monthly Resort Report',f'Period: {first} to {end-timedelta(days=1)} | Generated: {datetime.now():%b %d, %Y %I:%M %p}',['Date','Total bookings','Net revenue','Avg','Rating','Resorts'],rows or [['No resorts in selected scope','','','','','']],[70,85,120,115,85,302],notes=[f'Total bookings: {totals[0]} | Net revenue: {money(totals[1])} | Resorts: {len(resorts)}','Net revenue means verified payments collected within the selected month; pending and rejected payments are excluded. Expenses and refunds are not tracked by this system. Avg = net revenue divided by bookings created in the month; N/A means no bookings. Rating = average of reviews posted in the month.'],wide=True)
    finally:cursor.close();connection.close()
