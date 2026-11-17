"""Vercel serverless entrypoint.

Vercel's Python runtime looks for a WSGI/ASGI callable named ``app``.
Note: Vercel functions cannot hold WebSocket connections, so the Channels
consumers in ``chat/`` are not reachable there; the frontend falls back to the
REST chat endpoints (see FRONTEND/src/config.js, VITE_ENABLE_WEBSOCKET).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_buetians.settings')

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()
