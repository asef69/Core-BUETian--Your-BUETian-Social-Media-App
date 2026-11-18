"""Small helpers for reading and validating request parameters.

They raise DRF's ``ValidationError`` so bad input becomes a clean 400 response
(through ``utils.exceptions.custom_exception_handler``) instead of a 500.
"""
from rest_framework.exceptions import ValidationError

# Hard ceiling for any ``limit`` style parameter so one request cannot ask the
# database for an unbounded number of rows.
MAX_LIMIT = 200

# PostgreSQL INTEGER ceiling: anything larger would overflow in the database.
MAX_INT = 2147483647


def get_int_param(params, name, default, minimum=None, maximum=None):
    """Read ``name`` from a QueryDict/dict as an integer.

    - missing or empty -> ``default``
    - not an integer   -> 400
    - outside ``minimum``/``maximum`` -> clamped into range
    """
    raw = params.get(name)
    if raw is None or str(raw).strip() == '':
        value = default
    else:
        try:
            value = int(str(raw).strip())
        except (TypeError, ValueError):
            raise ValidationError({name: 'Must be an integer.'})

    if minimum is not None and value is not None and value < minimum:
        value = minimum
    ceiling = MAX_INT if maximum is None else min(maximum, MAX_INT)
    if value is not None and value > ceiling:
        value = ceiling
    return value


def get_limit(params, default=20, maximum=MAX_LIMIT):
    return get_int_param(params, 'limit', default, minimum=1, maximum=maximum)


def get_offset(params, default=0):
    return get_int_param(params, 'offset', default, minimum=0)


def get_page(params, default=1):
    return get_int_param(params, 'page', default, minimum=1)


def get_float_param(params, name, default=None, maximum=99999999.99):
    """Finite number, clamped to +-maximum (default: what NUMERIC(10,2) columns can hold)."""
    raw = params.get(name)
    if raw is None or str(raw).strip() == '':
        return default
    try:
        value = float(str(raw).strip())
    except (TypeError, ValueError):
        raise ValidationError({name: 'Must be a number.'})
    if value != value or value in (float('inf'), float('-inf')):
        raise ValidationError({name: 'Must be a finite number.'})
    return max(-maximum, min(maximum, value))


def page_offset(page, limit):
    """OFFSET for a 1-based page, kept inside PostgreSQL's INTEGER range."""
    return min((page - 1) * limit, MAX_INT)


def require_fields(data, *names):
    """400 if any of ``names`` is missing or blank in the request body."""
    missing = [n for n in names if data.get(n) in (None, '')]
    if missing:
        raise ValidationError({'error': 'Missing required field(s): ' + ', '.join(missing)})
