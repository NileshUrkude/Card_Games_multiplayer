import json
import random
import time
from functools import lru_cache
from itertools import combinations
from math import ceil

from core.base_game import BaseGame

# ------------------------------------------------------------------
# Two Player Rummy: 1 human + 1 computer, 52 cards, 13 each.
# Joker rank = the rank of the 27th card. That card stays beside the face-down pile.
# A turn: draw → arrange groups → discard. The discard ends the turn.
# If the 13 cards left after a discard form four valid groups (3, 3, 3 and 4),
# the player wins the round by discarding.
# ------------------------------------------------------------------

RANK_ORDER = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["♠", "♥", "♦", "♣"]
MAX_GROUPS = 4
MAX_ROUND_POINTS = 80
DRAW_TIME = 60            # seconds to discard after drawing (human players only)
MATCH_TARGET = 500        # the first player to reach this total wins the game

def make_deck():
    """All 52 cards as text, like 'A♠' or '10♥'."""
    return [rank + suit for suit in SUITS for rank in RANK_ORDER]


def rank_of(code):        # "10♥" → "10"
    return code[:-1]


def suit_of(code):        # "10♥" → "♥"
    return code[-1]


def card_points(rank):
    """A, 10, J, Q, K = 10 points. Other cards = their number."""
    if rank in ("A", "10", "J", "Q", "K"):
        return 10
    return int(rank)


def sequence_value(rank, ace_high):
    """Number used to check runs. Ace is 1 (low) or 14 (high)."""
    if rank == "A":
        return 14 if ace_high else 1
    return {"J": 11, "Q": 12, "K": 13}.get(rank) or int(rank)


class RummyGame(BaseGame):
    """The rules of Two Player Rummy. The server decides everything.
    The screen only shows the table and sends the player's choice."""

    def __init__(self, seats):
        super().__init__(seats)
        self.mode = "single"
        self.start()

    def name(self, seat):
        return self.seats[seat]["name"]

    def is_bot(self, seat):
        return bool(self.seats[seat].get("bot"))

    def is_joker(self, code):
        return rank_of(code) == self.joker_rank

    def points_of(self, code):
        return 0 if self.is_joker(code) else card_points(rank_of(code))

    # ---------- setting up ----------

    def start(self):
        self.scores = [0, 0]              # total points: seat 0 (human), seat 1 (computer)
        self.match_over = False           # True when someone has reached MATCH_TARGET
        self.final_winner = None
        self.round = 0
        self.round_over = False
        self.winner = None
        self.revealed = None
        self.round_points = [0, 0]
        self.hold = False                 # True while a play stays on screen
        self.hold_for = 1.0
        self.pending = None               # what to do when the hold ends
        self.deadline = None              # when the 1-minute discard timer ends
        self.drawn_card = None            # the card drawn this turn
        self.deal()

    def deal(self):
        """Shuffle, deal 13 each, and set up the piles."""
        self.round += 1
        self.round_over = False
        self.winner = None
        self.revealed = None
        self.round_points = [0, 0]
        self.groups = [[], []]            # each player's arrangement (list of groups)
        self.deadline = None
        self.drawn_card = None

        deck = make_deck()
        random.shuffle(deck)

        # The 27th card (index 26) sets the Joker rank and stays beside the face-down pile
        self.joker_rank = rank_of(deck[26])
        self.indicator = deck[26]

        self.hands = [deck[0:13], deck[13:26]]   # 13 cards each
        self.discard = [deck[27]]                 # the first discard is the next card, not the 27th
        self.draw = deck[28:]                     # face-down pile (top = first card)

        # Round 1 starts with the human. The starter alternates each round.
        self.turn = (self.round - 1) % 2
        self.phase = "draw"                       # draw → discard
        self.message = f"Round {self.round}. Joker: {self.joker_rank}. {self.name(self.turn)} starts."

    def next_round(self):
        """The host starts a new round, unless the game is already over."""
        if self.round_over and not self.match_over:
            self.deal()


    # ---------- checking groups ----------

    def check_group(self, codes):
        """Is this one group valid? Returns (True, 'set' or 'sequence') or (False, reason)."""
        n = len(codes)
        if n not in (3, 4):
            return False, "a group needs 3 or 4 cards"

        # Jokers only fill gaps, so we need at least two real cards to know the group
        real = [c for c in codes if not self.is_joker(c)]
        if len(real) < 2:
            return False, "use at least two real cards (Jokers only fill gaps)"

        # SET: the same rank, with different suits
        if len({rank_of(c) for c in real}) == 1:
            if len({suit_of(c) for c in real}) == len(real):
                return True, "set"
            return False, "a set needs different suits"

        # SEQUENCE: one suit, in a run. Jokers fill the missing cards.
        if len({suit_of(c) for c in real}) != 1:
            return False, "a sequence needs one suit"
        for ace_high in (False, True):    # Ace can be low (A-2-3) or high (Q-K-A)
            values = sorted(sequence_value(rank_of(c), ace_high) for c in real)
            if len(set(values)) != len(values):
                continue
            if values[-1] - values[0] + 1 <= n:   # the run fits inside the group's size
                return True, "sequence"
        return False, "the cards are not in one run"

    def group_status(self, codes):
        ok, reason = self.check_group(codes)
        return {"ok": ok, "reason": "" if ok else reason}

    def check_declaration(self, hand, groups):
        """None if the hand is a winning hand, otherwise the reason why not."""
        if sorted(len(g) for g in groups) != [3, 3, 3, 4]:
            return "You need four groups: three of 3 cards and one of 4"
        flat = [c for g in groups for c in g]
        if sorted(flat) != sorted(hand):
            return "Every card must be in a group"
        for i, g in enumerate(groups, 1):
            ok, reason = self.check_group(g)
            if not ok:
                return f"Group {i} is not valid: {reason}"
        return None

    def best_groups(self, hand):
        """Find the most cards that can sit in valid groups (at most 4 groups).
        Returns (how_many_cards_grouped, list_of_groups). Used by the computer."""
        n = len(hand)
        options = [[] for _ in range(n)]
        for size in (3, 4):
            for combo in combinations(range(n), size):
                codes = [hand[i] for i in combo]
                if self.check_group(codes)[0]:
                    mask = 0
                    for i in combo:
                        mask |= 1 << i
                    for i in combo:
                        options[i].append((mask, codes))

        full = (1 << n) - 1

        @lru_cache(maxsize=None)
        def search(decided, used):
            if decided == full:
                return 0, ()
            i = next(k for k in range(n) if not (decided >> k) & 1)
            best = search(decided | (1 << i), used)          # leave this card loose
            if used < MAX_GROUPS:
                for mask, codes in options[i]:
                    if mask & decided:
                        continue
                    count, rest = search(decided | mask, used + 1)
                    if count + len(codes) > best[0]:
                        best = (count + len(codes), (codes,) + rest)
            return best

        count, groups = search(0, 0)
        return count, [list(g) for g in groups]

    def arrangement(self, seat):
        """The groups a player has made. The computer uses its best grouping."""
        if self.groups[seat]:
            return self.groups[seat]
        if self.is_bot(seat):
            return self.best_groups(self.hands[seat])[1]
        return []

    def clean_groups(self, seat, groups):
        """Keep only cards that are really in this player's hand, each card used once."""
        hand = self.hands[seat]
        used = set()
        result = []
        for group in (groups or [])[:MAX_GROUPS]:
            cleaned = []
            for code in group:
                if code in hand and code not in used:
                    used.add(code)
                    cleaned.append(code)
            if cleaned:
                result.append(cleaned)
        return result

    # ---------- what a player may do ----------

    def legal_moves(self, seat):
        if self.hold or self.round_over or seat != self.turn:
            return []
        if self.phase == "draw":
            return ["draw:deck", "draw:discard"]
        if self.phase == "discard":
            return ["discard"]
        return []

    def apply_move(self, seat, move):
        # Every action is small JSON text, for example {"do": "draw", "pile": "deck"}
        try:
            data = json.loads(move)
        except (TypeError, ValueError):
            return False
        kind = data.get("do")

        if self.round_over or self.hold:
            return False                  # nothing changes during a hold or after a round

        # Arranging groups does not use a turn, so it works at any time
        if kind == "arrange":
            self.groups[seat] = self.clean_groups(seat, data.get("groups", []))
            return True

        if seat != self.turn:
            return False                  # not my turn
        if kind == "draw" and self.phase == "draw":
            return self.draw_card(seat, data.get("pile"))
        if kind == "discard" and self.phase == "discard":
            return self.discard_card(seat, data.get("card"))
        return False

    # ---------- the two steps of a turn ----------

    def draw_card(self, seat, pile):
        if pile == "discard":
            if not self.discard:
                return False
            card = self.discard.pop()     # only the top discard card can be taken
            self.message = f"{self.name(seat)} took {card} from the discard pile"
        else:
            if not self.draw:
                if len(self.discard) <= 1:
                    self.message = "No cards left. The turn passes."
                    self.pass_turn()
                    return True
                self.refill_draw()        # shuffle the old discards into a new face-down pile
            card = self.draw.pop(0)
            self.message = f"{self.name(seat)} drew a card"

        self.hands[seat].append(card)
        self.drawn_card = card
        # The human has 60 seconds to discard. The computer plays at once, so no timer.
        self.deadline = None if self.is_bot(seat) else time.time() + DRAW_TIME
        self.phase = "discard"
        self.hold = True
        self.hold_for = 1.0
        self.pending = "after_draw"
        return True

    def refill_draw(self):
        """The face-down pile is empty: keep the top discard card and shuffle the rest."""
        top = self.discard.pop()
        self.draw = self.discard[:]
        random.shuffle(self.draw)
        self.discard = [top]

    def discard_card(self, seat, card):
        if card not in self.hands[seat]:
            return False
        grouped = {c for g in self.groups[seat] for c in g}
        if card in grouped:
            self.message = "Take the card out of its group before you discard it"
            return True
        self.hands[seat].remove(card)
        self.discard.append(card)
        self.message = f"{self.name(seat)} discarded {card}"
        self.finish_discard(seat)
        return True

    def finish_discard(self, seat):
        """After a discard: a winning hand ends the round, otherwise the turn passes."""
        self.deadline = None
        self.drawn_card = None
        self.groups[seat] = self.clean_groups(seat, self.groups[seat])
        if self.check_declaration(self.hands[seat], self.arrangement(seat)) is None:
            self.end_round(seat)
            return
        self.pass_turn()

    def pass_turn(self):
        self.hold = True
        self.hold_for = 1.0
        self.pending = "pass"

    def tick(self):
        """Called once a second while a human has drawn. If the time is up, the drawn
        card is discarded automatically and the turn passes."""
        if self.deadline is None or self.round_over or self.hold or self.phase != "discard":
            return False
        if time.time() < self.deadline:
            return False
        seat, card = self.turn, self.drawn_card
        if card is None or card not in self.hands[seat]:
            self.deadline = None
            return False
        # Take the card out of any group, then discard it
        self.groups[seat] = [[c for c in g if c != card] for g in self.groups[seat]]
        self.groups[seat] = [g for g in self.groups[seat] if g]
        self.hands[seat].remove(card)
        self.discard.append(card)
        self.message = f"Time is up: {self.name(seat)} discarded {card} automatically"
        self.finish_discard(seat)
        return True

    # ---------- the 1 second hold ----------

    def advance(self):
        """Called when the 1 second hold is over."""
        if not self.hold:
            return
        self.hold = False
        step, self.pending = self.pending, None
        if step == "pass":
            self.turn = (self.turn + 1) % 2
            self.phase = "draw"
            self.message = f"{self.name(self.turn)}'s turn: draw a card"
        # after a draw, the same player keeps the turn and must discard

    # ---------- scoring ----------

    def end_round(self, winner):
        """The winner gets the loser's loose card points (capped at 80).
        The first player to reach MATCH_TARGET (500) wins the whole game."""
        loser = 1 - winner
        self.revealed = [self.arrangement(0), self.arrangement(1)]
        grouped = {c for g in self.revealed[loser] for c in g}
        loose = [c for c in self.hands[loser] if c not in grouped]
        points = min(MAX_ROUND_POINTS, sum(self.points_of(c) for c in loose))

        self.scores[winner] += points
        self.round_points = [0, 0]
        self.round_points[winner] = points
        self.round_over = True
        self.winner = winner
        self.phase = "over"

        if self.scores[winner] >= MATCH_TARGET:
            self.match_over = True
            self.final_winner = winner
            self.message = f"{self.name(winner)} reaches {MATCH_TARGET} and wins the game!"
        else:
            self.message = f"{self.name(winner)} went out and wins the round! +{points} points"
    # ---------- the computer player ----------

    def bot_pick_pile(self, seat):
        """Take the discard only if it helps the hand, or if it is a Joker."""
        hand = self.hands[seat]
        top = self.discard[-1]
        if not self.draw and self.discard:
            return "discard"
        if self.is_joker(top):
            return "discard"
        if self.best_groups(hand + [top])[0] > self.best_groups(hand)[0]:
            return "discard"
        return "deck"

    def bot_discard(self, seat):
        """Discard the card that leaves the most cards grouped.
        Jokers are never thrown away. Ties drop the highest-value card."""
        hand = self.hands[seat]
        best_score, best_card = None, None
        for card in hand:
            remaining = [c for c in hand if c != card]
            grouped = self.best_groups(remaining)[0]
            tie = -100 if self.is_joker(card) else -self.points_of(card)
            score = (grouped, tie)
            if best_score is None or score > best_score:
                best_score, best_card = score, card
        return best_card

    def bot_move(self, seat):
        """The computer plays by the same rules as the human."""
        if self.phase == "draw":
            return json.dumps({"do": "draw", "pile": self.bot_pick_pile(seat)})
        return json.dumps({"do": "discard", "card": self.bot_discard(seat)})

    # ---------- what each player's screen gets ----------

    def state_for(self, seat):
        """Each player sees their OWN cards. The other player's cards stay hidden."""
        other = 1 - seat
        my_groups = self.groups[seat]
        grouped = {c for g in my_groups for c in g}
        return {
            "phase": self.phase,
            "turn": self.turn,
            "hold": self.hold,
            "drawn_card": self.drawn_card if seat == self.turn else None,  # the card just drawn (blue outline)
            "my_moves": self.legal_moves(seat),
            "joker_rank": self.joker_rank,
            "indicator": self.indicator,              # the 27th card, beside the face-down pile
            "timer_left": ceil(max(0, self.deadline - time.time())) if self.deadline else None,
            "my_hand": list(self.hands[seat]),
            "my_groups": my_groups,
            "my_group_status": [self.group_status(g) for g in my_groups],
            "my_ungrouped": [c for c in self.hands[seat] if c not in grouped],
            "opp_count": len(self.hands[other]),
            "draw_count": len(self.draw),
            "discard_top": self.discard[-1] if self.discard else None,
            "discard_count": len(self.discard),
            "scores": self.scores,
            "round": self.round,
            "drawn_card": self.drawn_card if seat == self.turn else None,   # the card just drawn (blue)
            "target": MATCH_TARGET,
            "match_over": self.match_over,
            "final_winner": self.final_winner,
            "round_points": self.round_points,
            "round_over": self.round_over,
            "winner": self.winner,
            "revealed": self.revealed if self.round_over else None,
            "message": self.message,
        }