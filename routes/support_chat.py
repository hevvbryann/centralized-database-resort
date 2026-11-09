"""Resort-scoped customer/team conversations shared by owner and caretaker."""
import secrets,hmac
from flask import request,session,redirect,url_for,render_template,jsonify,abort,flash
from app import app
from config import get_connection
from models.customer_support import ensure_customer_support_messages_table

def _actor(cursor):
    role=session.get('role');aid=session.get('account_id')
    if role not in ('customer','owner','caretaker') or not aid:abort(401)
    cursor.execute("SELECT account_id FROM accounts WHERE account_id=%s AND account_status='Active'",(aid,))
    if not cursor.fetchone():abort(403)
    return role,aid

def _scope(role,alias='r'):
    if role=='owner':return f'EXISTS(SELECT 1 FROM owners scope_owner WHERE scope_owner.owner_id={alias}.owner_id AND scope_owner.account_id=%s)'
    return f"EXISTS(SELECT 1 FROM caretakers scope_caretaker WHERE scope_caretaker.resort_id={alias}.resort_id AND scope_caretaker.account_id=%s AND scope_caretaker.status='Active')"

def _chat(resort_id=None,customer_id=None):
    if session.get('role') not in ('customer','owner','caretaker'):return redirect(url_for('login'))
    connection=get_connection();cursor=connection.cursor(dictionary=True)
    try:
        ensure_customer_support_messages_table(cursor);connection.commit()
        role,aid=_actor(cursor);selected=None;threads=[];resorts=[];messages=[];customer=None
        session.setdefault('support_csrf',secrets.token_urlsafe(32))
        if role=='customer':
            customer_id=aid
            try:resort_id=int(request.values.get('resort_id') or 0) or None
            except ValueError:abort(400)
            cursor.execute('''SELECT r.resort_id,r.resort_name,o.account_id AS owner_account_id
                FROM resorts r JOIN owners o ON o.owner_id=r.owner_id
                JOIN accounts a ON a.account_id=o.account_id
                WHERE a.account_status='Active' AND (r.status='Active' OR EXISTS(
                    SELECT 1 FROM customer_support_messages m WHERE m.resort_id=r.resort_id
                    AND (m.sender_account=%s OR m.receiver_account=%s))) ORDER BY r.resort_name''',(aid,aid))
            resorts=cursor.fetchall();selected=next((r for r in resorts if r['resort_id']==resort_id),None)
            if resort_id and not selected:abort(404)
        else:
            cursor.execute(f'''SELECT m.support_message_id,m.message,m.sent_at,r.resort_id,r.resort_name,
                customer.account_id AS customer_account_id,customer.fullname AS customer_name,
                (SELECT COUNT(*) FROM customer_support_messages unread WHERE unread.resort_id=r.resort_id
                 AND unread.sender_account=customer.account_id AND unread.is_read=0) AS unread_count
                FROM customer_support_messages m JOIN resorts r ON r.resort_id=m.resort_id
                JOIN customers c ON (c.account_id=m.sender_account OR c.account_id=m.receiver_account)
                JOIN accounts customer ON customer.account_id=c.account_id
                WHERE {_scope(role)} AND m.support_message_id=(SELECT MAX(latest.support_message_id)
                  FROM customer_support_messages latest WHERE latest.resort_id=r.resort_id
                  AND (latest.sender_account=customer.account_id OR latest.receiver_account=customer.account_id))
                ORDER BY m.support_message_id DESC''',(aid,))
            threads=cursor.fetchall()
            endpoint='owner_support_thread' if role=='owner' else 'caretaker_support_thread'
            for thread in threads:thread['url']=url_for(endpoint,resort_id=thread['resort_id'],customer_account_id=thread['customer_account_id'])
            if resort_id is not None:
                cursor.execute(f'SELECT r.resort_id,r.resort_name FROM resorts r WHERE r.resort_id=%s AND {_scope(role)}',(resort_id,aid));selected=cursor.fetchone()
                cursor.execute('SELECT a.account_id,a.fullname FROM accounts a JOIN customers c ON c.account_id=a.account_id WHERE a.account_id=%s',(customer_id,));customer=cursor.fetchone()
                if not selected or not customer:abort(404)
                cursor.execute('SELECT 1 FROM customer_support_messages WHERE resort_id=%s AND (sender_account=%s OR receiver_account=%s) LIMIT 1',(resort_id,customer_id,customer_id))
                if not cursor.fetchone():abort(404)
        if request.method=='POST':
            token=request.form.get('csrf_token','')
            if not hmac.compare_digest(token,session['support_csrf']):abort(400,'Your form expired. Reload and try again.')
            if not selected:abort(400,'Choose a resort first.')
            message=request.form.get('message','').strip()
            if not 1<=len(message)<=2000:abort(400,'Enter a message between 1 and 2000 characters.')
            receiver=selected['owner_account_id'] if role=='customer' else customer_id
            cursor.execute('INSERT INTO customer_support_messages(resort_id,sender_account,receiver_account,message) VALUES(%s,%s,%s,%s)',(resort_id,aid,receiver,message));connection.commit()
            if request.accept_mimetypes.best=='application/json':return jsonify(ok=True)
            flash('Your message was sent.','success');return redirect(request.path+('?resort_id='+str(resort_id) if role=='customer' else ''))
        if selected:
            cursor.execute('''SELECT m.support_message_id,m.sender_account,m.message,m.sent_at,
                a.fullname AS sender_name,CASE WHEN c.account_id IS NOT NULL THEN 'customer'
                    WHEN o.account_id IS NOT NULL THEN 'owner' ELSE 'caretaker' END AS sender_role
                FROM customer_support_messages m JOIN accounts a ON a.account_id=m.sender_account
                LEFT JOIN customers c ON c.account_id=a.account_id LEFT JOIN owners o ON o.account_id=a.account_id
                WHERE m.resort_id=%s AND (m.sender_account=%s OR m.receiver_account=%s)
                ORDER BY m.support_message_id DESC LIMIT 200''',(resort_id,customer_id,customer_id));messages=list(reversed(cursor.fetchall()))
            if role=='customer':cursor.execute('UPDATE customer_support_messages SET is_read=1 WHERE resort_id=%s AND receiver_account=%s AND is_read=0',(resort_id,aid))
            else:cursor.execute('UPDATE customer_support_messages SET is_read=1 WHERE resort_id=%s AND sender_account=%s AND is_read=0',(resort_id,customer_id))
            connection.commit()
        for message in messages:
            message['sent_at']=message['sent_at'].strftime('%b %d, %Y %I:%M %p') if message['sent_at'] else ''
            message['mine']=message['sender_account']==aid
        if request.args.get('format')=='json':
            return jsonify(messages=messages,threads=[{k:t[k] for k in ['resort_name','customer_name','message','unread_count','url']} for t in threads])
        dashboard={'customer':'customer_dashboard','owner':'admin_dashboard','caretaker':'caretaker_dashboard'}[role]
        return render_template('support_chat.html',chat_role=role,selected_resort=selected,customer=customer,resorts=resorts,threads=threads,messages=messages,dashboard_url=url_for(dashboard))
    finally:cursor.close();connection.close()

@app.route('/customer_support',methods=['GET','POST'])
def customer_support():
    if session.get('role')!='customer':return redirect(url_for('login'))
    return _chat()

@app.route('/owner/support')
def owner_support():
    if session.get('role')!='owner':return redirect(url_for('login'))
    return _chat()

@app.route('/owner/support/<int:resort_id>/<int:customer_account_id>',methods=['GET','POST'])
def owner_support_thread(resort_id,customer_account_id):
    if session.get('role')!='owner':return redirect(url_for('login'))
    return _chat(resort_id,customer_account_id)

@app.route('/caretaker/support')
def caretaker_support():
    if session.get('role')!='caretaker':return redirect(url_for('login'))
    return _chat()

@app.route('/caretaker/support/<int:resort_id>/<int:customer_account_id>',methods=['GET','POST'])
def caretaker_support_thread(resort_id,customer_account_id):
    if session.get('role')!='caretaker':return redirect(url_for('login'))
    return _chat(resort_id,customer_account_id)
