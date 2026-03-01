from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc,context):
    """
    Custom exception handler for standardized error responses across the API.
    
    Configuration:
        Add to settings.py:
        REST_FRAMEWORK = {
            'EXCEPTION_HANDLER': 'utils.exceptions.custom_exception_handler'
        }
    
    Purpose:
        - Wraps all DRF exceptions in consistent format
        - Adds error flag for easy client-side detection
        - Includes exception message and details
    
    Args:
        exc (Exception): The exception that was raised
        context (dict): Context information about the exception
            {
                'view': ViewClass instance,
                'args': View args,
                'kwargs': View kwargs,
                'request': Request object
            }
    
    Returns:
        Response: DRF Response with standardized error format or None
    
    Standard Error Response Format:
        {
            "error": true,
            "message": "Error description",
            "details": {
                # Original DRF error details (field-specific errors, etc.)
            }
        }
    
    Example Error Responses:
        Validation Error:
        {
            "error": true,
            "message": "Invalid input",
            "details": {
                "email": ["This field is required."],
                "password": ["Password must be at least 8 characters."]
            }
        }
        
        Authentication Error:
        {
            "error": true,
            "message": "Authentication credentials were not provided.",
            "details": {
                "detail": "Authentication credentials were not provided."
            }
        }
    
    Notes:
        - Only handles exceptions recognized by DRF
        - Returns None for unhandled exceptions (500 errors)
        - Client can check 'error' field to detect failures
    """
    response=exception_handler(exc,context)

    if response is not None:
        custom_response={
            'error':True,
            'message':str(exc),
            'details':response.data
        }
        response.data=custom_response

    return response    
