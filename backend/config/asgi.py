import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django_app = get_asgi_application()  # must come before the imports below

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from rooms.routing import websocket_urlpatterns             # noqa: E402

application = ProtocolTypeRouter({
    "http": django_app,                              # normal API calls
    "websocket": URLRouter(websocket_urlpatterns),   # live game connection
})