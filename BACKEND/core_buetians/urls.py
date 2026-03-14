from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
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
    permission_classes=(permissions.AllowAny,),
)
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/posts/', include('posts.urls')),
    path('api/search/', include('core_buetians.search_urls')),
    path('api/chat/', include('chat.urls')),
    path('api/groups/', include('groups.urls')),
    path('api/marketplace/', include('marketplace.urls')),
    path('api/forums/', include('forums.urls')),
    path('api/notifications/', include('notification.urls')),
    path('api/blogs/', include('core_buetians.blog_urls')),
    
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc')
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [path('__debug__/', include(debug_toolbar.urls))]
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)