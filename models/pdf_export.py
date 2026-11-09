"""Small, reusable PDF layouts with repeating headers and safe text wrapping."""
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
import sys
try:
    import reportlab
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'vendor'))
    import reportlab
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from flask import send_file

def money(value):
    return 'PHP {:,.2f}'.format(float(value or 0))

def pdf_response(filename, title, subtitle, headers, rows, widths=None, notes=(), wide=False):
    font=Path('C:/Windows/Fonts/arial.ttf')
    if not font.exists():font=Path(reportlab.__file__).parent/'fonts/Vera.ttf'
    if 'ResortBody' not in pdfmetrics.getRegisteredFontNames():pdfmetrics.registerFont(TTFont('ResortBody',str(font)))
    styles=getSampleStyleSheet()
    body=ParagraphStyle('Body',fontName='ResortBody',fontSize=9,leading=13,wordWrap='CJK')
    heading=ParagraphStyle('Heading',parent=body,fontSize=18,leading=23,textColor=colors.HexColor('#176b46'),spaceAfter=12)
    def para(value):return Paragraph(escape(str(value if value is not None else '—')).replace('\n','<br/>'),body)
    stream=BytesIO();page=landscape(A4) if wide else A4
    doc=SimpleDocTemplate(stream,pagesize=page,rightMargin=32,leftMargin=32,topMargin=32,bottomMargin=42,title=title,author='Pansol Resorts')
    story=[Paragraph('Pansol Resorts',heading),Paragraph(escape(title),styles['Heading2']),para(subtitle),Spacer(1,16)]
    data=[[para(v) for v in headers]]+[[para(v) for v in row] for row in rows]
    table=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
    table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6f2eb')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#ceded3')),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    story.append(table)
    for note in notes:story.extend([Spacer(1,12),para(note)])
    def footer(canvas,document):
        canvas.setFont('ResortBody',8);canvas.setFillColor(colors.HexColor('#64766e'))
        canvas.drawString(32,22,'Pansol Resorts | Reservation and reporting system')
        canvas.drawRightString(page[0]-32,22,'Page '+str(document.page))
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    stream.seek(0)
    response=send_file(stream,mimetype='application/pdf',as_attachment=True,download_name=filename,max_age=0)
    response.headers['Cache-Control']='private, no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    return response
