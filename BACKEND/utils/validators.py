"""Reusable field validators for user-supplied data.

Each helper returns the cleaned value or raises ``ValidationError`` (-> HTTP 400),
so views never hand malformed values to PostgreSQL and turn them into 500s.
"""
import re
from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError

BLOOD_GROUPS = ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
HALL_ATTACHMENTS = ('Resident', 'Attached')
POST_VISIBILITIES = ('public', 'private', 'followers')
POST_MEDIA_TYPES = ('text', 'image', 'video')

_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _err(field, message):
    raise ValidationError({field: message})


def clean_str(value, field, max_length, required=False, allow_blank=True):
    if value is None:
        if required:
            _err(field, 'This field is required.')
        return None
    if not isinstance(value, str):
        _err(field, 'Must be a string.')
    if '\x00' in value:
        _err(field, 'Null characters are not allowed.')
    value = value.strip()
    if not value and (required or not allow_blank):
        _err(field, 'This field may not be blank.')
    if len(value) > max_length:
        _err(field, f'Ensure this field has no more than {max_length} characters.')
    return value


MAX_INT = 2147483647


def clean_int(value, field, required=False, minimum=None, maximum=MAX_INT):
    if value is None or value == '':
        if required:
            _err(field, 'This field is required.')
        return None
    if isinstance(value, bool):
        _err(field, 'Must be an integer.')
    if isinstance(value, float) and not value.is_integer():
        _err(field, 'Must be a whole number.')
    try:
        number = int(str(value).strip()) if not isinstance(value, float) else int(value)
    except (TypeError, ValueError):
        _err(field, 'Must be an integer.')
    if minimum is not None and number < minimum:
        _err(field, f'Must be at least {minimum}.')
    if maximum is not None and number > maximum:
        _err(field, f'Must be at most {maximum}.')
    return number


def clean_decimal(value, field, required=False, minimum=None, maximum=None):
    if value is None or value == '':
        if required:
            _err(field, 'This field is required.')
        return None
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        _err(field, 'Must be a number.')
    if not number.is_finite():
        _err(field, 'Must be a number.')
    if minimum is not None and number < Decimal(str(minimum)):
        _err(field, f'Must be at least {minimum}.')
    if maximum is not None and number > Decimal(str(maximum)):
        _err(field, f'Must be at most {maximum}.')
    return number


def clean_choice(value, field, choices, required=False):
    if value is None or value == '':
        if required:
            _err(field, 'This field is required.')
        return None
    if value not in choices:
        _err(field, 'Must be one of: ' + ', '.join(choices))
    return value


def clean_email(value, field='email'):
    email = clean_str(value, field, 100, required=True).lower()
    if not _EMAIL_RE.match(email):
        _err(field, 'Enter a valid email address.')
    return email


def clean_password(value, field='password'):
    if not isinstance(value, str) or not value:
        _err(field, 'This field is required.')
    if len(value) < 8:
        _err(field, 'Password must be at least 8 characters long.')
    if len(value) > 128:
        _err(field, 'Password must be at most 128 characters long.')
    if value.isdigit():
        _err(field, 'Password cannot be only numbers.')
    return value


def _allowed_media_hosts():
    from django.conf import settings
    return tuple(getattr(settings, 'ALLOWED_MEDIA_HOSTS', ('res.cloudinary.com',)))


def clean_media_url(value, field='media_url', max_length=500):
    """Accept only the app's own media paths or https URLs on an allowed storage host.

    Arbitrary external URLs would let users plant tracking pixels / hotlinked content,
    and javascript:/data: URLs are never valid.
    """
    from urllib.parse import urlsplit
    value = clean_str(value, field, max_length)
    if not value:
        return None
    if value.startswith('/') and not value.startswith('//'):
        return value
    parts = urlsplit(value)
    host = (parts.hostname or '').lower()
    if parts.scheme == 'https' and any(host == h or host.endswith('.' + h) for h in _allowed_media_hosts()):
        return value
    _err(field, 'Must be an uploaded file URL from this site or its media host.')


def escape_like(term):
    """Escape LIKE/ILIKE metacharacters so user input matches literally (backslash is the escape)."""
    return str(term).replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')


def safe_procedure_message(message, fallback='The request could not be completed'):
    """Stored procedures return SQLERRM on failure. Pass through the friendly
    messages they define themselves, but hide raw PostgreSQL text (constraint,
    table or column names) from API clients."""
    text = (message or '').lower()
    if any(word in text for word in (
        'violates', 'constraint', 'relation ', 'column ', 'syntax', 'invalid input',
        'out of range', 'overflow', 'too long', 'does not exist', 'null value',
    )):
        return fallback
    return message or fallback


def parse_bool(value, default=None):
    """'false' / '0' / 'no' are False; real bools and None are handled too."""
    if value is None or value == '':
        return default
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in ('true', '1', 'yes', 'on'):
        return True
    if text in ('false', '0', 'no', 'off'):
        return False
    return default


def clean_datetime(value, field):
    """ISO-8601 datetime string -> string PostgreSQL accepts for a TIMESTAMP column."""
    from datetime import datetime
    if value in (None, ''):
        return None
    if not isinstance(value, str):
        _err(field, 'Must be an ISO 8601 date/time string.')
    try:
        parsed = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError:
        _err(field, 'Must be an ISO 8601 date/time string.')
    return parsed.isoformat(sep=' ')


def clean_tags(value, field='tags', max_tags=20, max_length=50):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.split(',')
    if not isinstance(value, (list, tuple)):
        _err(field, 'Must be a list of strings.')
    if len(value) > max_tags:
        _err(field, f'At most {max_tags} tags are allowed.')
    cleaned = []
    for tag in value:
        tag = clean_str(tag, field, max_length)
        if tag and tag not in cleaned:
            cleaned.append(tag)
    return cleaned
