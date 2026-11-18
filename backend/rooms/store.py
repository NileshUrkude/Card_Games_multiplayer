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
    "asta_chamma": {"name": "Asta Chamma", "icon": "8♦", "seats": 4, "min_players": 4},
    "court": {"name": "Court", "icon": "Q♠", "seats": 4, "min_players": 4},
}


def is_team_room(room):
    """Team rooms have places grouped into teams:
    Court always, and Asta Chamma only in team mode.
    Team 1 = places 0 and 2, Team 2 = places 1 and 3."""
    if room["game"] == "court":
        return True
    return room["game"] == "asta_chamma" and room.get("mode") == "team"


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
    info = GAMES[game]
    me = {"player_id": player_id, "name": name}
    room = {"code": code, "game": game, "seats": [None] * info["seats"],
            "solo": solo, "mode": mode}

    if solo:
        # Play with bots: I take place 0, bots take the other places
        bots = [{"player_id": None, "name": f"Bot {i}", "bot": True}
                for i in range(1, info["min_players"])]
        room["seats"] = [me] + bots
    else:
        # Team rooms: the creator picks the place. Other rooms: first place.
        place = seat if is_team_room(room) and 0 <= seat < info["seats"] else 0
        room["seats"][place] = me

    ROOMS[code] = room
    if solo:
        start_game(room)                  # no waiting room for bot games
    return code, player_id


def join_room(code, name, seat=None):
    """Join a room. In a team room, 'seat' is the place the player picked.
    In other rooms, the player takes the first free place."""
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
        "teams": is_team_room(room),      # True = show Team 1 / Team 2 in the lobby
    }


def start_game(room):
    """Fill the empty places with bots, then start the game."""
    if room.get("engine"):
        return                            # already started
    if is_team_room(room):
        # Team rooms keep every player in their own place, so teams stay correct.
        # An empty place becomes a bot in that same place.
        seats = []
        for i, s in enumerate(room["seats"]):
            seats.append(s if s else {"player_id": None, "name": f"Bot {i + 1}", "bot": True})
    else:
        # Other rooms: humans first, then bots until the minimum is reached
        info = GAMES[room["game"]]
        seats = [s for s in room["seats"] if s]
        while len(seats) < info["min_players"]:
            bot_no = sum(1 for s in seats if s.get("bot")) + 1
            seats.append({"player_id": None, "name": f"Bot {bot_no}", "bot": True})
    room["seats"] = seats

    engine = GAME_CLASSES[room["game"]](seats)
    engine.mode = room.get("mode", "single")   # Asta Chamma and Court read this
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