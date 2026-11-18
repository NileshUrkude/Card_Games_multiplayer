from .satte_pe_satta.game import SatteGame
from .five_three_two.game import FiveThreeTwoGame
from .asta_chamma.game import AstaGame
from .court.game import CourtGame

# Room's game id → the class that runs it
GAME_CLASSES = {
    "satte_pe_satta": SatteGame,
    "five_three_two": FiveThreeTwoGame,
    "asta_chamma": AstaGame,
    "court": CourtGame,
}