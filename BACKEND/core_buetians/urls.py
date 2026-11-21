from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from django.http import JsonResponse
from decouple import config as env_config


def health(request):
    """Unauthenticated liveness probe for load balancers / Render."""
    return JsonResponse({'status': 'ok'})



urlpatterns = [
    path('health/', health, name='health'),
    path('api/users/', include('users.urls')),
    path('api/posts/', include('posts.urls')),
    path('api/search/', include('core_buetians.search_urls')),
    path('api/chat/', include('chat.urls')),
    path('api/groups/', include('groups.urls')),
    path('api/marketplace/', include('marketplace.urls')),
    path('api/forums/', include('forums.urls')),
    path('api/notifications/', include('notification.urls')),
    path('api/blogs/', include('core_buetians.blog_urls')),
    
]

if settings.SWAGGER_ENABLED:
    # Imported lazily: drf_yasg is heavy and only needed when the docs are switched on.
    from drf_yasg.views import get_schema_view
    from drf_yasg import openapi

    schema_view = get_schema_view(
        openapi.Info(
            title="Core BUETians API",
            default_version='v1',
            description="Social Media Platform for BUET Students",
            contact=openapi.Contact(email="admin@corebuetians.com"),
        ),
        public=True,
        permission_classes=(permissions.AllowAny,) if settings.DEBUG else (permissions.IsAdminUser,),
    )
    urlpatterns += [
        path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
        path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    ]

# The Django admin has no registered models in this project; only expose it when asked for.
if settings.DEBUG or env_config('ADMIN_ENABLED', default=False, cast=bool):
    urlpatterns += [path('admin/', admin.site.urls)]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [path('__debug__/', include(debug_toolbar.urls))]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)