from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import store


@api_view(["GET"])
def games(request):
    """List of games for the home screen."""
    return Response([
        {"id": key, "name": g["name"], "icon": g["icon"], "seats": g["seats"]}
        for key, g in store.GAMES.items()
    ])


@api_view(["POST"])
def create(request):
    game = request.data.get("game")
    name = request.data.get("name", "").strip()
    if game not in store.GAMES or not name:
        return Response({"error": "Enter your name first"}, status=400)
    solo = bool(request.data.get("solo", False))
    code, player_id = store.create_room(game, name, solo)
    return Response({"code": code, "player_id": player_id})


@api_view(["POST"])
def join(request):
    code = request.data.get("code", "").strip().upper()
    name = request.data.get("name", "").strip()
    if not name:
        return Response({"error": "Enter your name first"}, status=400)
    player_id, error = store.join_room(code, name)
    if error:
        return Response({"error": error}, status=400)
    return Response({"code": code, "player_id": player_id})


@api_view(["GET"])
def room(request, code):
    found = store.ROOMS.get(code.upper())
    if found is None:
        return Response({"error": "Room not found"}, status=404)
    return Response(store.room_state(found))