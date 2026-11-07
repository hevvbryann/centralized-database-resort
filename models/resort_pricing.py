"""Date-based base rates. Tour add-ons and saved booking totals are separate."""
from decimal import Decimal


def booking_base_price(resort, check_in, legacy_price=None):
    """Choose the rate by check-in day: Mon–Fri weekday, Sat–Sun weekend."""
    field = 'weekend_price' if check_in.weekday() >= 5 else 'weekday_price'
    value = resort.get(field)
    if value is None:
        value = resort.get('price')
    if value is None:
        value = legacy_price
    return Decimal(str(value)) if value is not None else None
