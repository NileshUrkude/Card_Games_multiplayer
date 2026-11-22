import random
import string
import uuid

from games import GAME_CLASSES

# All rooms live here, in memory. They reset when the server restarts.
ROOMS = {}

# The games we support. To add a game, add it here and in games/__init__.py.
# The games we support. "icon" is the text shown in the centre of the home-page tile.
GAMES = {
    "satte_pe_satta": {"name": "Satte pe Satta", "icon": "7♥", "seats": 5, "min_players": 4},
    "five_three_two": {"name": "5-3-2", "icon": "5-3-2", "seats": 3, "min_players": 3},
    "asta_chamma": {"name": "Asta Chamma", "icon": "8-4", "seats": 4, "min_players": 4},
    "court": {"name": "Court", "icon": "A♠", "seats": 4, "min_players": 4},
    "rummy": {"name": "Rummy", "icon": "AKQ 🃏", "seats": 2, "min_players": 2},
    "chourail": {"name": "Chourail", "icon": "AAA", "seats": 4, "min_players": 2},
}

def is_team_room(room):
    """Team rooms: Court always, and Asta Chamma in team mode.
    Team 1 = places 0 and 2, Team 2 = places 1 and 3."""
    if room["game"] == "court":
        return True
    return room["game"] == "asta_chamma" and room.get("mode") == "team"


def room_size(game, mode):
    """How many places a room has. Chourail uses its mode ("2" or "4") as the player count."""
    if game == "chourail" and mode in ("2", "4"):
        return int(mode)
    return GAMES[game]["seats"]


def minimum_players(room):
    """How many players are needed before the game starts. Bots fill the rest."""
    if room["game"] == "chourail":
        return room_size(room["game"], room.get("mode"))
    return GAMES[room["game"]]["min_players"]


def make_code():
    """A random 5-letter room code, like QXKTA."""
    while True:
        code = "".join(random.choices(string.ascii_uppercase, k=5))
        if code not in ROOMS:
            return code


def create_room(game, name, solo=False, mode="single", seat=0):
    """Make a room. solo=True means 'play with bots' and starts at once.
    seat = the place the creator picks (used only in team rooms)."""
    code = make_code()
    player_id = str(uuid.uuid4())         # secret id, so the browser knows who I am
    me = {"player_id": player_id, "name": name}
    room = {"code": code, "game": game, "solo": solo, "mode": mode}

    size = room_size(game, mode)
    room["seats"] = [None] * size

    if solo:
        # Play with bots: I take the first place, bots take the rest
        bots = [{"player_id": None, "name": f"Bot {i}", "bot": True}
                for i in range(1, minimum_players(room))]
        room["seats"] = [me] + bots
    else:
        # Team rooms: the creator picks the place. Other rooms: the first place.
        place = seat if is_team_room(room) and 0 <= seat < size else 0
        room["seats"][place] = me

    ROOMS[code] = room
    if solo:
        start_game(room)                  # no waiting room for bot games
    return code, player_id


def join_room(code, name, seat=None):
    """Join a room. In a team room, 'seat' is the place picked. Otherwise the first free place."""
    room = ROOMS.get(code)
    if room is None:
        return None, "Room not found"

    player_id = str(uuid.uuid4())
    if is_team_room(room) and seat is not None:
        if not 0 <= seat < len(room["seats"]):
            return None, "Place not found"
        if room["seats"][seat] is not None:
            return None, "That place is already taken"
        room["seats"][seat] = {"player_id": player_id, "name": name}
        return player_id, None

    for i, s in enumerate(room["seats"]):
        if s is None:                     # first free place
            room["seats"][i] = {"player_id": player_id, "name": name}
            return player_id, None
    return None, "Room is full"


def seat_of(room, player_id):
    """Which place is this player in? None if they are not in the room."""
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
        "teams": is_team_room(room),
    }


def start_game(room):
    """Fill the empty places with bots, then start the game."""
    if room.get("engine"):
        return                            # already started

    if is_team_room(room):
        # Team rooms keep every player in their own place, so teams stay correct
        seats = []
        for i, s in enumerate(room["seats"]):
            seats.append(s if s else {"player_id": None, "name": f"Bot {i + 1}", "bot": True})
    else:
        seats = [s for s in room["seats"] if s]
        need = minimum_players(room)
        while len(seats) < need:
            bot_no = sum(1 for s in seats if s.get("bot")) + 1
            seats.append({"player_id": None, "name": f"Bot {bot_no}", "bot": True})
    room["seats"] = seats

    engine = GAME_CLASSES[room["game"]](seats)
    engine.mode = room.get("mode", "single")   # some games read this
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