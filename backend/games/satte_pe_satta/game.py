from core.base_game import BaseGame
from core.cards import full_deck, shuffle_and_deal

TOTAL_ROUNDS = 5


class SatteGame(BaseGame):
    def name(self, seat):
        return self.seats[seat]["name"]

    # ---------- setting up ----------
    def start(self):
        self.scores = [0] * len(self.seats)  # total points (lower is better)
        self.round = 0
        self.match_over = False
        self.round_points = []
        self.message = ""
        self.next_round()

    def next_round(self):
        """Deal a fresh round. The holder of 7♥ always starts."""
        if self.round > 0 and (not self.round_over or self.match_over):
            return  # can't start a new round before this one is finished
        self.round += 1
        self.hands = shuffle_and_deal(full_deck(), len(self.seats))
        self.layout = {}      # cards on the table, e.g. {"♠": {"low": 5, "high": 9}}
        self.played_by = {}   # card code -> seat that played it
        self.status = [""] * len(self.seats)  # small text under each name, like "Pass"
        self.hold = False     # True for 1 second after a play or pass (nobody can act)
        self.hold_for = 1.0   # how many seconds the wait lasts
        self.round_over = False
        self.round_points = []
        for seat, hand in enumerate(self.hands):
            if any(card.code == "7♥" for card in hand):
                self.turn = seat
        self.message = f"Round {self.round}: {self.name(self.turn)} starts with 7♥"

    # ---------- rules ----------
    def can_play(self, card):
        if not self.layout:
            return card.code == "7♥"  # the first play must be 7♥ to start the round
        if card.suit not in self.layout:
            return card.value == 7    # a 7 opens a new suit on the table
        row = self.layout[card.suit]  # cards must extend the open suit by one step on each side
        return card.value == row["low"] - 1 or card.value == row["high"] + 1

    def legal_moves(self, seat):
        return [card.code for card in self.hands[seat] if self.can_play(card)]

    def apply_move(self, seat, code):
        # Ignore moves while the table is pausing, when it's not this player's turn,
        # or when the chosen card is not legal for the current layout.
        if self.hold or self.round_over or seat != self.turn:
            return False
        if code not in self.legal_moves(seat):
            return False

        card = next(c for c in self.hands[seat] if c.code == code)
        self.hands[seat].remove(card)
        self.played_by[code] = seat
        self.status[seat] = ""

        # Put the card on the table: widen the suit's row
        if card.suit not in self.layout:
            self.layout[card.suit] = {"low": card.value, "high": card.value}
        else:
            row = self.layout[card.suit]
            row["low"] = min(row["low"], card.value)
            row["high"] = max(row["high"], card.value)

        self.message = f"{self.name(seat)} played {code}"
        if not self.hands[seat]:
            self.finish_round(seat)
        else:
            # A bot's card stays on screen 1.5 sec (0.5 landing + 1 sec to look).
            # A human's own card has no wait. Either way the turn moves on.
            self.end_turn(seat, 1.5)
        return True

    # ---------- turns and passing ----------
    def end_turn(self, seat, seconds):
        """A bot's play or pass stays on screen for a moment before the next turn.
        A human's own play has no wait: the next player starts at once."""

        # Small pause makes animations readable without blocking the human player.
        self.hold = True
        self.hold_for = seconds


    def go_next(self):
        """Give the turn to the next player (anticlockwise on screen)."""
        self.turn = (self.turn + 1) % len(self.seats)
        self.status[self.turn] = ""   # their old "Pass" message goes away

    def apply_pass(self, seat):
        """A player with no valid card passes."""
        if self.hold or self.round_over or seat != self.turn:
            return False
        if self.legal_moves(seat):
            return False  # you may only pass if you really have no valid card
        self.status[seat] = "Pass"    # shown next to the player's name
        self.message = f"{self.name(seat)} has no valid card: Pass"
        self.end_turn(seat, 1.0)      # a bot's "Pass" stays 1 second
        return True

    def advance(self):
        """Called when a bot's wait is over: the next player's turn starts."""
        if self.hold:
            self.hold = False
            self.go_next()
            
    # ---------- scoring ----------
    def finish_round(self, winner):
        self.round_over = True
        # A player keeps the total of remaining card values in hand; the winner has 0.
        self.round_points = [sum(c.value for c in hand) for hand in self.hands]
        for seat, points in enumerate(self.round_points):
            self.scores[seat] += points
        self.match_over = self.round >= TOTAL_ROUNDS
        self.message = f"{self.name(winner)} finished all cards and wins the round!"

    def is_over(self):
        return self.match_over

    def winners(self):
        best = min(self.scores)  # lowest total wins
        return [seat for seat, pts in enumerate(self.scores) if pts == best]

    # ---------- what each player sees ----------
    def state_for(self, seat):
        state = super().state_for(seat)  # my_hand + hand_sizes
        # I can act only on my turn, and not during the 1 second hold
        my_turn = seat == self.turn and not self.round_over and not self.hold
        moves = self.legal_moves(seat) if my_turn else []
        state.update({
            "layout": self.layout,
            "played_by": self.played_by,
            "status": self.status,
            "turn": self.turn,
            "my_moves": moves,
            "can_pass": my_turn and not moves,  # Pass button: my turn, no valid card
            "scores": self.scores,
            "round": self.round,
            "total_rounds": TOTAL_ROUNDS,
            "round_over": self.round_over,
            "round_points": self.round_points,
            "match_over": self.match_over,
            "winners": self.winners() if self.match_over else [],
            "message": self.message,
        })
        return state