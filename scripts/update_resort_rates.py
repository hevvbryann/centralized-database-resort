"""Apply the agreed weekday/weekend rates to existing resorts, never bookings."""
import argparse
from decimal import Decimal
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import get_connection

RATES = {
    'luckymiels': (10000, 20000), 'renalyn': (10000, 25000),
    'triplez': (8000, 15000), 'sunscape': (8000, 15000),
    'magickingdom': (10000, 25000),
    # The user confirmed that Aqua Scape refers to the existing Gallely row.
    'gallely': (10000, 25000),
}


def normalize(name):
    return re.sub(r'[^a-z0-9]', '', name.lower()).removesuffix('resort')


def main(apply=False):
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)
    try:
        cursor.execute('SELECT resort_id, resort_name, price, weekday_price, weekend_price FROM resorts' + (' FOR UPDATE' if apply else ''))
        rows = cursor.fetchall()
        matched = {}
        for row in rows:
            key = normalize(row['resort_name'])
            if key in RATES:
                if key in matched:
                    raise RuntimeError('More than one resort matches ' + key)
                matched[key] = row
        if set(matched) != set(RATES):
            raise RuntimeError('Missing resort rows: ' + ', '.join(set(RATES) - set(matched)))
        for key, row in matched.items():
            weekday, weekend = map(Decimal, RATES[key])
            if apply:
                cursor.execute('UPDATE resorts SET price=%s, weekday_price=%s, weekend_price=%s WHERE resort_id=%s',
                               (weekday, weekday, weekend, row['resort_id']))
            print(f"{row['resort_name']}: weekday {weekday:,.2f}; weekend {weekend:,.2f}")
        if apply:
            cursor.execute('SELECT resort_id, weekday_price, weekend_price FROM resorts')
            saved = {row['resort_id']: row for row in cursor.fetchall()}
            for key, row in matched.items():
                actual = saved[row['resort_id']]
                if (actual['weekday_price'], actual['weekend_price']) != tuple(map(Decimal, RATES[key])):
                    raise RuntimeError('Saved rates did not match for ' + key)
            connection.commit()
            print('Committed and verified all six rates. Existing reservations were not changed.')
        else:
            print('Preview only. Pass --apply to save these rates.')
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    main(parser.parse_args().apply)
