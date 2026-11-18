# ------------------------------------------------------------------
# board.py: the BOARD settings for Asta Chamma.
#
# Coordinates in this file are (row, column), counted from 0 to 4.
# Your board uses 1 to 5, so take 1 away from each number:
#   your (5,3)  -> code (4,2)   (the bottom middle house = the bottom player's home)
#   your (3,3)  -> code (2,2)   (the centre = the finish)
#
# The path is written for the BOTTOM player. Every other player walks
# the same path, turned a quarter turn at a time.
# ------------------------------------------------------------------


def rotate(cell, turns):
    """Turn a house a quarter turn clockwise, 'turns' times.
    Used to make the other players' paths from the bottom player's path."""
    r, c = cell
    for _ in range(turns % 4):
        r, c = c, 4 - r
    return (r, c)


# ---- 1. The path for the bottom player ----
# 24 steps from start to finish. Step 1 is the first house after home.
BASE_TRACK = [
    # Steps 1 to 15: the OUTER ring, ANTICLOCKWISE.
    # It starts just right of home and ends at (4,1), which is your (5,2).
    (4, 3), (4, 4), (3, 4), (2, 4), (1, 4), (0, 4), (0, 3), (0, 2),
    (0, 1), (0, 0), (1, 0), (2, 0), (3, 0), (4, 0), (4, 1),

    # Steps 16 to 23: the INNER ring, CLOCKWISE.
    # It starts from (4,1) going up into (3,1), and ends next to the centre.
    (3, 1), (2, 1), (1, 1), (1, 2), (1, 3), (2, 3), (3, 3), (3, 2),

    # Step 24: the centre = the finish. An exact count is needed to land here.
    (2, 2),
]

# The finish is the last step of the path (24)
FINISH = len(BASE_TRACK)
# Steps 1 to 15 are the outer ring. Step 16 and up are the inner ring.
INNER_START = 16

# ---- 2. Players ----
# Seat order: 0 = Blue (top), 1 = Green (right), 2 = Orange (bottom), 3 = Yellow (left).
# "color" = the colour of that player's tokens. Change the number here to change the colour.
PLAYERS = [
    {"name": "Blue",   "color": "#1d4ed8"},
    {"name": "Green",  "color": "#15803d"},
    {"name": "Orange", "color": "#ea580c"},
    {"name": "Yellow", "color": "#eab308"},
]
TOKENS_PER_PLAYER = 4
TEAMS = [[0, 2], [1, 3]]   # team mode: seats 0 and 2 play together, seats 1 and 3 play together

# ---- 3. Each player's path and home ----
BOTTOM_SEAT = 2            # the seat whose path is BASE_TRACK (no turning needed)

# Turn the bottom path so that each seat gets its own path
TRACKS = [
    [rotate(cell, (seat - BOTTOM_SEAT) % 4) for cell in BASE_TRACK]
    for seat in range(len(PLAYERS))
]

# Each player's home (the cross house), turned in the same way
HOMES = [rotate((4, 2), (seat - BOTTOM_SEAT) % 4) for seat in range(len(PLAYERS))]

# Safe houses: a token standing here cannot be cut. Currently the four cross houses.
SAFE_CELLS = set(HOMES)

# ---- 4. Throws ----
# Chance of each result. The values must add up to 1.0 (100%).
#   "8" = 4 shells open  -> 8 houses, extra turn
#   "4" = 0 shells open  -> 4 houses, extra turn
#   "1", "2", "3"        -> normal throws
THROWS = {"8": 0.08, "4": 0.12, "1": 0.25, "2": 0.30, "3": 0.25}  # adds up to 1.0
# Throws that give an extra turn
EXTRA_TURN = {"8", "4"}

# How many shells face open side up (for the picture)
OPEN_SIDES = {"8": 4, "4": 0, "1": 1, "2": 2, "3": 3}


def cell_of(seat, step):
    """The house a token stands on after 'step' moves (1 to 24)."""
    return TRACKS[seat][step - 1]