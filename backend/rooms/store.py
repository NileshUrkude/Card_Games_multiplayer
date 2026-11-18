import random
import string
import uuid

from games import GAME_CLASSES

# All rooms live here, in memory. They reset when the server restarts.
ROOMS = {}

# The games we support. To add a game, add it here and in games/__init__.py.
GAMES = {
    "satte_pe_satta": {"name": "Satte pe Satta", "icon": "7♥", "seats": 5, "min_players": 4},
    "five_three_two": {"name": "5-3-2", "icon": "5♠", "seats": 3, "min_players": 3},
    "asta_chamma": {"name": "Asta Chamma", "icon": "X", "seats": 4, "min_players": 4},
}


def make_code():
    """A random 5-letter room code, like QXKTA."""
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=5))
        if code not in ROOMS:
            return code


def create_room(game, name, solo=False, mode="single"):
    """Make a room. solo=True means 'play with bots' and starts at once.
    mode is "single" or "team" (only Asta Chamma uses it)."""
    code = make_code()
    player_id = str(uuid.uuid4())   # secret id, so the browser knows who I am
    info = GAMES[game]
    me = {"player_id": player_id, "name": name}

    if solo:
        # Play with bots: I am seat 0, bots take the other seats
        bots = [{"player_id": None, "name": f"Bot {i}", "bot": True}
                for i in range(1, info["min_players"])]
        seats = [me] + bots
    else:
        # Play with friends: empty seats wait for people to join
        seats = [None] * info["seats"]
        seats[0] = me

    ROOMS[code] = {"code": code, "game": game, "seats": seats, "solo": solo, "mode": mode}
    if solo:
        start_game(ROOMS[code])     # no waiting room for bot games
    return code, player_id


def join_room(code, name):
    room = ROOMS.get(code)
    if room is None:
        return None, "Room not found"
    for i, seat in enumerate(room["seats"]):
        if seat is None:            # first empty seat
            player_id = str(uuid.uuid4())
            room["seats"][i] = {"player_id": player_id, "name": name}
            return player_id, None
    return None, "Room is full"


def seat_of(room, player_id):
    """Which seat is this player in? None if they are not in the room."""
    for i, seat in enumerate(room["seats"]):
        if seat and seat["player_id"] == player_id:
            return i
    return None


def room_state(room):
    """What we send to the browser (names only, no secret ids)."""
    info = GAMES[room["game"]]
    return {
        "code": room["code"],
        "game": room["game"],
        "game_name": info["name"],
        "min_players": info["min_players"],
        "seats": [s["name"] if s else None for s in room["seats"]],
        "solo": room.get("solo", False),
        "mode": room.get("mode", "single"),
    }


def start_game(room):
    """Fill empty seats with bots up to the minimum, then start the game."""
    if room.get("engine"):
        return                              # already started
    info = GAMES[room["game"]]
    seats = [s for s in room["seats"] if s]
    while len(seats) < info["min_players"]:
        bot_no = sum(1 for s in seats if s.get("bot")) + 1
        seats.append({"player_id": None, "name": f"Bot {bot_no}", "bot": True})
    room["seats"] = seats

    engine = GAME_CLASSES[room["game"]](seats)
    engine.mode = room.get("mode", "single")   # Asta Chamma reads this (other games ignore it)
    engine.start()
    room["engine"] = engine


def state_for(room, seat):
    """Everything one player's browser needs, including only their own private parts."""
    state = room_state(room)
    state["my_seat"] = seat
    state["is_host"] = seat == 0
    engine = room.get("engine")
    state["started"] = engine is not None
    if engine:
        state["game_state"] = engine.state_for(seat)
    return state