import logging

from django.db import DataError, IntegrityError, ProgrammingError, OperationalError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def _flatten(detail):
    """Turn DRF error details into one human readable sentence."""
    if isinstance(detail, dict):
        parts = []
        for key, value in detail.items():
            text = _flatten(value)
            if key in ('error', 'detail', 'non_field_errors'):
                parts.append(text)
            else:
                parts.append(f'{key}: {text}')
        return ' '.join(p for p in parts if p)
    if isinstance(detail, (list, tuple)):
        return ' '.join(_flatten(item) for item in detail)
    return str(detail)


def custom_exception_handler(exc, context):
    """
    Standardised error responses for the whole API.

    Shape (always JSON):
        {
            "error":   "<readable message>",   # same text as "message"
            "message": "<readable message>",
            "details": { ...original DRF details... }
        }

    ``error`` is a string (not a boolean) because the frontend shows
    ``response.data.error`` directly in toasts / form errors.

    Database errors that a view did not handle (bad value for a column, broken
    foreign key, ...) are logged server-side and returned as a generic 400/500
    JSON body. The raw PostgreSQL message is never sent to the client.
    """
    response = exception_handler(exc, context)

    if response is not None:
        message = _flatten(response.data)
        response.data = {
            'error': message,
            'message': message,
            'details': response.data,
        }
        return response

    if isinstance(exc, ValueError) and 'NUL' in str(exc):
        # psycopg2 refuses strings containing \x00
        message = 'Null characters are not allowed in text values.'
        return Response(
            {'error': message, 'message': message},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, (DataError, IntegrityError)):
        logger.warning('Rejected by database constraint: %s', exc)
        message = 'The submitted data is invalid or refers to something that does not exist.'
        return Response(
            {'error': message, 'message': message},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, (ProgrammingError, OperationalError)):
        logger.exception('Database error while handling request', exc_info=exc)
        message = 'A server error occurred. Please try again later.'
        return Response(
            {'error': message, 'message': message},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return None
