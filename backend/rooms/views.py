from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import store


def as_int(value, default):
    """Turn a value from the browser into a whole number. Use the default if it is not one."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@api_view(["GET"])
def games(request):
    """List of games for the home screen."""
    return Response([
        {
            "id": key,
            "name": g["name"],
            "icon": g["icon"],
            "seats": g["seats"],
            "soon": g.get("soon", False),
        }
        for key, g in store.GAMES.items()
    ])


@api_view(["POST"])
def create(request):
    game = request.data.get("game")
    name = request.data.get("name", "").strip()
    solo = bool(request.data.get("solo", False))
    mode = request.data.get("mode", "single")
    seat = as_int(request.data.get("seat"), 0)     # the place picked in a team room

    if game == "chourail":
        # Chourail: the mode is the number of players, "2" or "4"
        mode = str(mode) if str(mode) in ("2", "4") else "4"
    elif mode not in ("single", "team"):
        mode = "single"

    if game not in store.GAMES or not name:
        return Response({"error": "Enter your name first"}, status=400)
    code, player_id = store.create_room(game, name, solo, mode, seat)
    return Response({"code": code, "player_id": player_id})


@api_view(["POST"])
def join(request):
    code = request.data.get("code", "").strip().upper()
    name = request.data.get("name", "").strip()
    seat = as_int(request.data.get("seat"), None)  # the place picked in a team room
    if not name:
        return Response({"error": "Enter your name first"}, status=400)
    player_id, error = store.join_room(code, name, seat)
    if error:
        return Response({"error": error}, status=400)
    return Response({"code": code, "player_id": player_id})


@api_view(["GET"])
def room(request, code):
    found = store.ROOMS.get(code.upper())
    if found is None:
        return Response({"error": "Room not found"}, status=404)
    return Response(store.room_state(found))