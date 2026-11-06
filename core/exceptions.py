from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    if isinstance(exc, ServiceError):
        return Response({
            'success': False,
            'error': exc.message,
            'status': exc.status_code,
        }, status=exc.status_code)

    response = exception_handler(exc, context)

    if response is not None:
        response.data = {
            'success': False,
            'error':   response.data,
            'status':  response.status_code,
        }

    return response


class ServiceError(Exception):
    # raised by service layer when business rules are violated
    def __init__(self, message, status_code=400):
        self.message     = message
        self.status_code = status_code
        super().__init__(message)