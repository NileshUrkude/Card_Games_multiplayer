class BaseGame:
    """Every game (Satte pe Satta, 5-3-2, Court...) follows this shape."""

    def __init__(self, seats):
        self.seats = seats  # list of players, humans and bots
        self.hands = []     # each item contains that seat's cards
        self.turn = None          # whose turn it is (seat number)
        self.round_over = False   # True when a round has ended
        # Base game state keeps the common rules that every card game shares.


    def start(self):
        """Deal cards and set up the first turn."""
        raise NotImplementedError

    def legal_moves(self, seat):
        """List of moves this seat is allowed to make now."""
        raise NotImplementedError

    def apply_move(self, seat, move):
        """Make the move and change the game state."""
        raise NotImplementedError

    def is_over(self):
        raise NotImplementedError

    def state_for(self, seat):
        """What this seat is allowed to see: own cards, others' card counts."""
        return {
            "my_hand": [c.code for c in self.hands[seat]],
            "hand_sizes": [len(h) for h in self.hands],
        }

    def next_round(self):
        """Games with several rounds override this."""
        pass