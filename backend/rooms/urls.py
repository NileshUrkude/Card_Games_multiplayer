from django.urls import path
from . import views

urlpatterns = [
    path("games/", views.games),
    path("rooms/create/", views.create),
    path("rooms/join/", views.join),
    path("rooms/<str:code>/", views.room),
]