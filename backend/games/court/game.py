from core.base_game import BaseGame


class CourtGame(BaseGame):
    """Placeholder for Court. It does nothing until the rules are added."""

    def start(self):
        self.turn = 0
        self.round_over = False
        self.match_over = False
        self.message = "Court rules are coming soon."

    def legal_moves(self, seat):
        return []                      # no moves yet

    def apply_move(self, seat, move):
        return False                   # reject every move

    def state_for(self, seat):
        # The screen only needs these values for now
        return {
            "message": self.message,
            "turn": self.turn,
            "my_moves": [],
            "round_over": False,
            "match_over": False,
        }