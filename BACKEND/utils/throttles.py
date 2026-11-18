"""Rate limiting for write endpoints.

Read requests (GET/HEAD/OPTIONS) are never throttled, so browsing and polling stay free;
only requests that change data are counted per user (or per IP when anonymous).
Rates are configured in settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
"""
from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import ScopedRateThrottle


class WriteScopedThrottle(ScopedRateThrottle):
    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)


def throttled(scope):
    """Class decorator: throttle the view's write methods under ``scope``."""
    def wrap(view_cls):
        view_cls.throttle_classes = [WriteScopedThrottle]
        view_cls.throttle_scope = scope
        return view_cls
    return wrap
