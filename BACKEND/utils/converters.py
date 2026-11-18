"""URL converters."""
from django.urls import register_converter

INT_MAX = 2147483647


class PositiveInt32:
    """Like <int:...> but limited to PostgreSQL INTEGER range.

    Larger ids can never exist, so they resolve to a plain 404 instead of an
    "function does not exist" database error (HTTP 500).
    """
    regex = r'[0-9]{1,10}'

    def to_python(self, value):
        number = int(value)
        if number > INT_MAX:
            raise ValueError(value)
        return number

    def to_url(self, value):
        return str(value)


register_converter(PositiveInt32, 'posint')
