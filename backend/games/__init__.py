from .satte_pe_satta.game import SatteGame
from .five_three_two.game import FiveThreeTwoGame

# Room's game id → the class that runs it. Add Court here later.
GAME_CLASSES = {
    "satte_pe_satta": SatteGame,
    "five_three_two": FiveThreeTwoGame,
}