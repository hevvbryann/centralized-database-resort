def ensure_review_schema(connection):
    cursor=connection.cursor()
    try:
        cursor.execute('''CREATE TABLE IF NOT EXISTS reservation_reviews (
            review_id INT AUTO_INCREMENT PRIMARY KEY,
            reservation_id INT NOT NULL,
            payment_id INT NULL,
            reviewer_account_id INT NULL,
            reviewer_role VARCHAR(30) NOT NULL,
            decision VARCHAR(20) NOT NULL,
            reason TEXT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE,
            FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL,
            FOREIGN KEY (reviewer_account_id) REFERENCES accounts(account_id) ON DELETE SET NULL
        )''')
        connection.commit()
    finally:cursor.close()

def rejection_reason(form):
    reason=(form.get('reason') or '').strip()
    if len(reason)<5 or len(reason)>2000:
        return None
    return reason

def save_review(cursor,reservation_id,payment_id,session,decision,reason):
    cursor.execute('''INSERT INTO reservation_reviews
        (reservation_id,payment_id,reviewer_account_id,reviewer_role,decision,reason)
        VALUES(%s,%s,%s,%s,%s,%s)''',(reservation_id,payment_id,session['account_id'],session['role'],decision,reason or ''))

def review_lock(connection):
    from models.postgres_compat import PostgresConnection
    return 'FOR UPDATE OF r' if isinstance(connection,PostgresConnection) else 'FOR UPDATE'
