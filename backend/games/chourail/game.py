import json
import random
from collections import Counter
from functools import lru_cache
from itertools import combinations

from core.base_game import BaseGame

# ------------------------------------------------------------------
# Chourail (Hazari): 2 or 4 players, 4 rounds per deal.
# Each player arranges 13 cards into 4 groups of 3, 3, 3 and 4 cards.
# Group 1 is the strongest and Group 4 the weakest.
# Round 1 uses Group 1, round 4 uses Group 4.
# The strongest group in a round wins and collects the points of every card played.
# The game ends after the deal in which someone reaches 1000 points.
# ------------------------------------------------------------------

SUITS = ["♠", "♥", "♦", "♣"]
RANK_VALUE = {"2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
              "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14}
GROUP_SIZES = [3, 3, 3, 4]     # Group 1 to 3 have 3 cards, Group 4 has 4
ROUNDS = 4                     # one round per group
TARGET = 1000                  # the deal in which someone reaches this ends the game

# Sequences from strongest to weakest.
# Ace is high in A-K-Q and low in A-2-3. K-A-2 is not allowed.
SEQUENCES = [("A", "K", "Q"), ("A", "2", "3"), ("K", "Q", "J"), ("Q", "J", "10"),
             ("J", "10", "9"), ("10", "9", "8"), ("9", "8", "7"), ("8", "7", "6"),
             ("7", "6", "5"), ("6", "5", "4"), ("5", "4", "3"), ("4", "3", "2")]
SEQ_STRENGTH = {frozenset(s): 100 - i for i, s in enumerate(SEQUENCES)}

# Combination categories: a bigger number is a stronger combination
TRAIL, PURE_SEQ, SEQ, COLOUR, PAIR, HIGH = 5, 4, 3, 2, 1, 0


def rank_of(code):      # "10♥" → "10"
    return code[:-1]


def suit_of(code):      # "10♥" → "♥"
    return code[-1]


def point_value(code):
    """A, K, Q, J, 10 = 10 points. 9 to 2 = 5 points."""
    return 10 if rank_of(code) in ("A", "K", "Q", "J", "10") else 5


def make_deck():
    """All 52 cards as text, like 'A♠' or '10♥'."""
    return [rank + suit for suit in SUITS for rank in RANK_VALUE for rank in [rank]]


def evaluate3(codes):
    """Strength of exactly 3 cards. Returns (key, name).
    A bigger key is a stronger combination. The key starts with the category,
    so the category always comes first."""
    ranks = [rank_of(c) for c in codes]
    values = [RANK_VALUE[r] for r in ranks]
    same_suit = len({suit_of(c) for c in codes}) == 1

    if len(set(ranks)) == 1:                         # three of the same rank
        return (TRAIL, (values[0],)), "Trail"

    strength = SEQ_STRENGTH.get(frozenset(ranks))    # three in a row
    if strength is not None:
        if same_suit:
            return (PURE_SEQ, (strength,)), "Pure Sequence"
        return (SEQ, (strength,)), "Sequence"

    if same_suit:                                    # one suit, not a run
        return (COLOUR, tuple(sorted(values, reverse=True))), "Colour"

    counts = Counter(ranks)
    if 2 in counts.values():                         # a pair plus one other card
        pair = next(r for r, k in counts.items() if k == 2)
        kicker = next(r for r, k in counts.items() if k == 1)
        return (PAIR, (RANK_VALUE[pair], RANK_VALUE[kicker])), "Pair"

    return (HIGH, tuple(sorted(values, reverse=True))), "High Card"


@lru_cache(maxsize=None)
def group_strength(codes):
    """Strength of a group. codes must be a sorted tuple.
    A group of 3 is judged as is. A group of 4 is judged by its best 3 cards.
    Returns (key, name, cards_used)."""
    if len(codes) == 3:
        key, name = evaluate3(list(codes))
        return key, name, codes
    best = None
    for combo in combinations(codes, 3):
        key, name = evaluate3(list(combo))
        if best is None or key > best[0]:
            best = (key, name, tuple(combo))
    return best


def best_triples(pool, limit):
    """The strongest 3-card groups that can be made from this pool."""
    combos = [tuple(sorted(c)) for c in combinations(pool, 3)]
    combos.sort(key=lambda g: group_strength(g)[0], reverse=True)
    return combos[:limit]


def auto_arrange(hand):
    """Arrange 13 cards into groups of 3, 3, 3 and 4, strongest first.

    Step by step:
    1. Take the strongest 3-card group from the cards left, and make it Group 1.
    2. Do the same for Group 2, then Group 3.
    3. The 4 cards left are Group 4.

    Why this is always valid: each group is the strongest that was still possible,
    so every later group can only be the same or weaker. Group 4's best 3 cards
    come from the cards that were still available when Group 3 was chosen, so they
    cannot beat Group 3."""
    pool = list(hand)
    groups = []
    for _ in range(3):
        # The strongest 3-card combination from the cards still left in the pool
        best = max(
            (tuple(sorted(c)) for c in combinations(pool, 3)),
            key=lambda g: group_strength(g)[0],
        )
        groups.append(list(best))
        for card in best:
            pool.remove(card)
    groups.append(sorted(pool))     # the last 4 cards are the weakest group
    return groups

class ChourailGame(BaseGame):
    """The rules of Chourail. The server decides everything.
    The screen only shows the table and sends the player's choices."""

    def __init__(self, seats):
        super().__init__(seats)
        self.mode = "4"
        self.start()

    def name(self, seat):
        return self.seats[seat]["name"]

    def is_bot(self, seat):
        return bool(self.seats[seat].get("bot"))

    def set_phase(self, phase):
        """Change the phase. The room clock reads round_over, so keep it in step."""
        self.phase = phase
        self.round_over = phase in ("round_result", "deal_result", "final")

    # ---------- setting up ----------

    def start(self):
        n = len(self.seats)
        self.totals = [0] * n            # points over all deals
        self.deal_no = 0
        self.match_over = False
        self.final_winners = []
        self.turn = None                 # there is no single turn in this game
        self.hold = False
        self.hold_for = 1.0
        self.pending = None
        self.deal()

    def deal(self):
        """Shuffle, deal 13 cards to each player, and start the arranging step."""
        n = len(self.seats)
        self.deal_no += 1
        self.round = 1
        self.leader = (self.deal_no - 1) % n      # the first player rotates each deal

        deck = make_deck()
        random.shuffle(deck)
        # 2 players use 26 cards (13 each). 4 players use all 52 cards (13 each).
        used = deck[:13 * n]
        self.hands = [used[i * 13:(i + 1) * 13] for i in range(n)]

        self.arr = [[[], [], [], []] for _ in range(n)]   # each player's 4 groups
        self.confirmed = [False] * n
        self.notice = [""] * n
        self.plays = []
        self.round_history = []
        self.round_pts = [[0] * n for _ in range(ROUNDS)]  # points won per round, per player
        self.hold = False
        self.pending = None
        self.set_phase("arrange")

        # Bots arrange and confirm their cards at once
        for s in range(n):
            if self.is_bot(s):
                self.arr[s] = auto_arrange(self.hands[s])
                self.confirmed[s] = True

        self.message = f"Deal {self.deal_no}: arrange your 13 cards into four groups (3, 3, 3 and 4)."

    def next_round(self):
        """The host moves on: the next round of this deal, or the next deal."""
        if self.phase == "round_result":
            self.round += 1
            self.start_reveal()
        elif self.phase == "deal_result":
            self.deal()

    # ---------- checking an arrangement ----------

    def clean(self, seat, groups):
        """Keep only cards that are really in this player's hand, each card once,
        and never more cards than a group takes."""
        hand = set(self.hands[seat])
        used = set()
        result = []
        for i in range(4):
            g = groups[i] if i < len(groups) else []
            row = []
            for c in g:
                if c in hand and c not in used and len(row) < GROUP_SIZES[i]:
                    used.add(c)
                    row.append(c)
            result.append(row)
        return result

    def check(self, seat):
        """Is this arrangement valid? Returns a list of problems and the group names."""
        arr = self.arr[seat]
        errors = []
        assigned = [c for g in arr for c in g]

        for i, g in enumerate(arr):
            if len(g) != GROUP_SIZES[i]:
                errors.append(f"Group {i + 1} needs {GROUP_SIZES[i]} cards (has {len(g)})")
        left = len(self.hands[seat]) - len(assigned)
        if left > 0:
            errors.append(f"{left} card(s) are not in a group yet")

        names = [group_strength(tuple(sorted(g)))[1] if len(g) in (3, 4) else None for g in arr]

        if not errors:
            # Group 1 must be the strongest, Group 4 the weakest
            strengths = [group_strength(tuple(sorted(g)))[0] for g in arr]
            for i in range(3):
                if strengths[i] < strengths[i + 1]:
                    errors.append(f"Group {i + 2} is stronger than Group {i + 1}. "
                                  f"Move the stronger group to the left.")
        return {"ok": not errors, "errors": errors, "names": names}

    # ---------- what a player may do ----------

    def legal_moves(self, seat):
        return []                                  # nothing is chosen by turns in this game

    def apply_move(self, seat, move):
        try:
            data = json.loads(move)
        except (TypeError, ValueError):
            return False
        kind = data.get("do")

        # Arranging is only possible before the cards are confirmed
        if self.phase != "arrange" or self.confirmed[seat]:
            return False

        if kind == "set":
            self.arr[seat] = self.clean(seat, data.get("groups", []))
            return True
        if kind == "validate":
            return True                            # the check is always shown anyway
        if kind == "auto":
            self.arr[seat] = auto_arrange(self.hands[seat])
            return True
        if kind == "clear":
            self.arr[seat] = [[], [], [], []]
            return True
        if kind == "confirm":
            problems = self.check(seat)["errors"]
            if problems:
                self.notice[seat] = "Fix this first: " + problems[0]
                return True
            self.confirmed[seat] = True
            self.notice[seat] = ""
            if all(self.confirmed):
                self.start_reveal()                # everyone is ready: round 1 begins
            return True
        return False

    # ---------- the rounds ----------

    def start_reveal(self):
        """Start a round. Players show their group one by one, leader first."""
        n = len(self.seats)
        self.set_phase("reveal")
        self.order = [(self.leader + k) % n for k in range(n)]
        self.reveal_pos = 0
        self.plays = []
        self.hold = True
        self.hold_for = 1.0
        self.pending = "reveal"
        self.message = f"Round {self.round}: {self.name(self.leader)} shows first"

    def finish_round(self):
        """Find the round winner, give them every point played, then continue by itself:
        the next round of this deal, the next deal, or the final result."""
        n = len(self.seats)
        r = self.round - 1

        # The strongest group wins. On a tie, the player who showed LATER wins.
        best_seat, best_key, best_name = None, None, ""
        for p in self.plays:                       # plays are in the order they were shown
            key, name, _ = group_strength(tuple(sorted(p["cards"])))
            if best_key is None or key >= best_key:
                best_seat, best_key, best_name = p["seat"], key, name

        points = sum(point_value(c) for p in self.plays for c in p["cards"])
        self.round_pts[r][best_seat] += points
        self.round_history.append({"round": self.round, "winner": best_seat,
                                   "name": best_name, "points": points})
        self.leader = best_seat                    # the round winner leads the next round
        self.message = (f"{self.name(best_seat)} wins round {self.round} with "
                        f"{best_name} and collects {points} points.")

        # More rounds in this deal: pause, then the next round starts by itself
        if self.round < ROUNDS:
            self.set_phase("round_result")
            self.hold = True
            self.hold_for = 3.0
            self.pending = "next"
            return

        # The deal is over: add its points to the totals
        deal_points = [sum(self.round_pts[k][s] for k in range(ROUNDS)) for s in range(n)]
        self.totals = [self.totals[s] + deal_points[s] for s in range(n)]
        top = max(self.totals)

        if top >= TARGET:
            # Someone reached the target: the game is over, no more deals
            self.match_over = True
            self.final_winners = [s for s in range(n) if self.totals[s] == top]
            self.set_phase("final")
            self.message = "Game over! " + " & ".join(self.name(s) for s in self.final_winners) + " wins."
            return

        # Nobody reached the target yet: pause, then the next deal starts by itself
        self.set_phase("deal_result")
        self.message = f"Deal {self.deal_no} finished. The next deal starts automatically."
        self.hold = True
        self.hold_for = 4.0
        self.pending = "next"

    # ---------- the 1 second hold ----------

    def advance(self):
        """Called when a 1 second hold (or a longer pause) is over."""
        if not self.hold:
            return
        self.hold = False
        step, self.pending = self.pending, None

        if step == "reveal":
            # Show the next player's group
            seat = self.order[self.reveal_pos]
            cards = list(self.arr[seat][self.round - 1])
            _, name, best = group_strength(tuple(sorted(cards)))
            self.plays.append({"seat": seat, "cards": cards, "name": name, "best": list(best)})
            self.reveal_pos += 1
            self.message = f"{self.name(seat)} shows {name}"
            self.hold = True
            self.hold_for = 1.0
            self.pending = "finish" if self.reveal_pos == len(self.order) else "reveal"

        elif step == "finish":
            # Everyone has shown: decide the round
            self.finish_round()

        elif step == "next":
            # The pause after a result is over: start the next round, or the next deal
            if self.phase == "round_result":
                self.round += 1
                self.start_reveal()
            elif self.phase == "deal_result":
                self.deal()
                
    # ---------- the bots ----------

    def bot_move(self, seat):
        return json.dumps({"do": "validate"})     # bots arrange at the deal, so this is never used

    # ---------- what each player's screen gets ----------

    def state_for(self, seat):
        """Each player sees their OWN cards and groups. Other players' cards stay hidden
        until they are shown in a round."""
        n = len(self.seats)
        hand = list(self.hands[seat])
        mine = self.arr[seat]
        assigned = {c for g in mine for c in g}
        return {
            "phase": self.phase,
            "round": self.round,
            "deal_no": self.deal_no,
            "players": n,
            "leader": self.leader,
            "my_hand": hand,
            "my_arr": mine,
            "my_pool": [c for c in hand if c not in assigned],
            "check": self.check(seat),
            "notice": self.notice[seat],
            "confirmed": list(self.confirmed),
            "arranged": [sum(len(g) for g in self.arr[s]) for s in range(n)],
            "plays": self.plays,                    # only the groups shown so far
            "round_history": self.round_history,
            "round_pts": self.round_pts,
            "deal_pts": [sum(self.round_pts[k][s] for k in range(ROUNDS)) for s in range(n)],
            "totals": self.totals,
            "target": TARGET,
            "match_over": self.match_over,
            "winners": self.final_winners if self.match_over else [],
            "hold": self.hold,
            "turn": None,
            "message": self.message,
        }