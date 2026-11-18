import random

from core.base_game import BaseGame

# ------------------------------------------------------------------
# Court: 4 players, 2 fixed teams, 36 cards, 9 tricks per round.
# Team A = seats 0 and 2, Team B = seats 1 and 3.
#
# Two roles:
#   SARKARI       = the player who got the FIRST card. Always leads the first trick.
#   TARGET HOLDER = the player who chooses trump. The highest bidder, or the Sarkari
#                   if nobody bid. Their team scores the target.
# ------------------------------------------------------------------

# Card ranks, lowest to highest. There is no 2 to 5 in this game.
RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"]
SUITS = ["♠", "♥", "♦", "♣"]

CARDS_PER_PLAYER = 9      # 36 cards / 4 players
TRICKS_PER_ROUND = 9      # 9 tricks, 4 cards each
DEFAULT_TARGET = 5        # target when nobody bids
MAX_TARGET = 9            # highest bid allowed
SCORE_CHOICES = ["50", "100"]


def team_of(seat):
    """0 = Team A (seats 0 and 2), 1 = Team B (seats 1 and 3)."""
    return seat % 2


def make_deck():
    """All 36 cards as text, like 'A♠' or '10♥'."""
    return [rank + suit for suit in SUITS for rank in RANKS]


def rank_of(code):      # "10♥" → "10"
    return code[:-1]


def suit_of(code):      # "10♥" → "♥"
    return code[-1]


def power(code):        # bigger number = stronger card
    return RANKS.index(rank_of(code))


def card_strength(code, lead, trump):
    """How strong one card is in the current trick.
    Trump beats everything. Then the led suit. Other suits never win."""
    if suit_of(code) == trump:
        return (2, power(code))
    if suit_of(code) == lead:
        return (1, power(code))
    return (0, 0)


class CourtGame(BaseGame):
    """The rules of Court. The server decides everything.
    The screen only shows the table and sends the player's choice."""

    def __init__(self, seats):
        super().__init__(seats)
        self.mode = "team"
        self.start()

    def name(self, seat):
        return self.seats[seat]["name"]

    # ---------- setting up ----------

    def start(self):
        self.points = [0, 0]              # total points: Team A, Team B
        self.winning_score = None         # chosen before the first deal
        self.round = 0
        self.dealer = 0                   # team index of the dealer
        self.round_over = False
        self.match_over = False
        self.winner_team = None
        self.round_points = [0, 0]        # points won in the last round
        self.hands = [[] for _ in range(4)]
        self.trick = []                   # cards on the table now: (seat, code)
        self.last_trick = []              # the previous trick (for the sweep animation)
        self.last_winner = None
        self.tricks_won = [0, 0]          # tricks per team in this round
        self.tricks_done = 0
        self.sarkari = None               # got the first card: always leads the first trick
        self.target_holder = None         # chooses trump, and their team scores the target
        self.target = DEFAULT_TARGET
        self.trump = None
        self.bid_value = DEFAULT_TARGET   # highest bid so far
        self.highest = None               # seat with the highest bid
        self.active = [True] * 4          # False = passed (out for this round)
        self.phase = "score"              # score → bid → trump → play
        self.turn = 0
        self.hold = False                 # True while a play stays on screen
        self.hold_for = 1.0
        self.pending = None               # what to do when the hold ends
        self.message = "Team A chooses the winning score: 50 or 100"

    def deal_round(self):
        """Shuffle the 36 cards and deal them ONE BY ONE, starting after the dealer.
        The player who gets the FIRST card is the Sarkari."""
        self.round += 1
        self.round_over = False
        self.round_points = [0, 0]
        self.tricks_won = [0, 0]
        self.tricks_done = 0
        self.trick = []
        self.last_trick = []
        self.last_winner = None
        self.trump = None
        self.target_holder = None
        self.target = DEFAULT_TARGET
        self.highest = None
        self.bid_value = DEFAULT_TARGET
        self.active = [True] * 4

        # The team with FEWER points deals. A tie goes to Team A.
        self.dealer = 0 if self.points[0] <= self.points[1] else 1

        # The first card goes to the player after the dealer. That player is the Sarkari.
        first = (self.dealer + 1) % 4
        self.sarkari = first

        # Deal one card at a time, round the table, starting with the Sarkari
        deck = make_deck()
        random.shuffle(deck)
        self.hands = [[] for _ in range(4)]
        for i, card in enumerate(deck):
            self.hands[(first + i) % 4].append(card)

        # Bidding starts with the Sarkari, then goes in seat order
        self.phase = "bid"
        self.turn = first
        self.message = f"{self.name(first)} got the first card: Sarkari. Bid 6 to 9, or pass."

    # ---------- the winning score (first step of the game) ----------

    def set_score(self, value):
        self.winning_score = value
        self.deal_round()                 # cards are dealt right after the score is chosen
        self.message = f"Winning score {value}. " + self.message
        self.hold = True
        self.hold_for = 1.0
        self.pending = None

    # ---------- what a player may do ----------

    def legal_moves(self, seat):
        if self.hold or self.round_over or self.match_over:
            return []                     # nobody acts during the 1 second hold
        if self.phase == "score":
            return list(SCORE_CHOICES) if seat == 0 else []
        if self.phase == "bid":
            if seat != self.turn:
                return []
            # Pass, or bid a number higher than the current bid (never below 6)
            raises = [str(n) for n in range(max(DEFAULT_TARGET + 1, self.bid_value + 1),
                                            MAX_TARGET + 1)]
            return ["pass"] + raises
        if self.phase == "trump":
            # Only the target holder chooses trump
            return list(SUITS) if seat == self.target_holder else []
        if self.phase == "play":
            if seat != self.turn:
                return []
            hand = self.hands[seat]
            if not self.trick:
                return list(hand)         # leading: any card
            lead = suit_of(self.trick[0][1])
            same = [c for c in hand if suit_of(c) == lead]
            # Follow the led suit if you can. If you cannot, any card (trump included).
            return same if same else list(hand)
        return []

    def apply_move(self, seat, move):
        if move not in self.legal_moves(seat):
            return False                  # wrong turn, wrong move, or during the hold
        if self.phase == "score":
            self.set_score(int(move))
        elif self.phase == "bid":
            self.bid(seat, move)
        elif self.phase == "trump":
            self.choose_trump(move)
        else:
            self.play_card(seat, move)
        return True

    # ---------- bidding ----------

    def bid(self, seat, move):
        if move == "pass":
            self.active[seat] = False     # a player who passes cannot come back this round
            self.message = f"{self.name(seat)} passed"
        else:
            self.bid_value = int(move)
            self.highest = seat
            self.message = f"{self.name(seat)} bids {move}"
        self.hold = True
        self.hold_for = 1.0
        self.pending = "bid"

    def next_bid(self):
        """After a bid or pass: is bidding over, or whose turn is it now?"""
        still_in = [s for s in range(4) if self.active[s]]

        # Case 1: everyone passed. Nobody bid, so the Sarkari keeps target 5.
        if not still_in:
            self.target_holder = self.sarkari
            self.target = DEFAULT_TARGET
            self.message = f"Nobody bid. {self.name(self.sarkari)} keeps target 5 and chooses trump."
            self.start_trump()
            return

        # Case 2: someone bid, and everyone else has passed.
        # The highest bidder is never out, so they are the one still in.
        if self.highest is not None and len(still_in) == 1:
            self.target_holder = self.highest
            self.target = self.bid_value
            self.message = f"{self.name(self.highest)} bid {self.target} and chooses trump."
            self.start_trump()
            return

        # Otherwise: the next player who has not passed, in seat order
        seat = self.turn
        for _ in range(4):
            seat = (seat + 1) % 4
            if self.active[seat]:
                break
        self.turn = seat
        if self.highest is None:
            self.message = f"{self.name(seat)}'s turn: bid 6 to 9 or pass"
        else:
            self.message = f"{self.name(seat)}'s turn: bid higher than {self.bid_value} or pass"

    def start_trump(self):
        self.phase = "trump"
        self.turn = self.target_holder    # the target holder chooses trump

    # ---------- trump ----------

    def choose_trump(self, suit):
        self.trump = suit
        self.phase = "play"
        self.turn = self.sarkari          # the SARKARI always leads the first trick
        self.message = f"{self.name(self.target_holder)} chose {suit}. {self.name(self.sarkari)} leads."
        self.hold = True
        self.hold_for = 1.0
        self.pending = None

    # ---------- playing tricks ----------

    def play_card(self, seat, code):
        self.hands[seat].remove(code)
        self.trick.append((seat, code))
        self.message = f"{self.name(seat)} played {code}"
        self.hold = True
        self.hold_for = 1.0
        self.pending = "card"

    def trick_winner(self):
        """The seat whose card is strongest in this trick."""
        lead = suit_of(self.trick[0][1])
        return max(self.trick, key=lambda item: card_strength(item[1], lead, self.trump))[0]

    def finish_trick(self):
        winner = self.trick_winner()
        self.tricks_won[team_of(winner)] += 1
        self.tricks_done += 1
        self.last_trick = [{"seat": s, "card": c} for s, c in self.trick]
        self.last_winner = winner
        self.trick = []
        self.turn = winner                # the winner starts the next trick
        self.message = f"{self.name(winner)} won the trick"

        if self.tricks_done == TRICKS_PER_ROUND:
            self.finish_round()
        else:
            # Pause for 1 second so the sweep to the winner can be seen
            self.hold = True
            self.hold_for = 1.0
            self.pending = "trick_done"

    # ---------- the 1 second hold ----------

    def advance(self):
        """Called when the 1 second hold is over. Moves the game to its next step."""
        if not self.hold:
            return
        self.hold = False
        step, self.pending = self.pending, None

        if step == "bid":
            self.next_bid()
        elif step == "card":
            if len(self.trick) == 4:
                self.finish_trick()       # all 4 cards are down: the winner takes them
            else:
                self.turn = (self.turn + 1) % 4   # next player, in seat order
        elif step == "trick_done":
            pass                          # the pause is over: the winner now leads

    # ---------- scoring ----------

    def finish_round(self):
        self.round_over = True
        # The target holder's team is the one that must reach the target
        holder_team = team_of(self.target_holder)
        won = self.tricks_won[holder_team]
        pts = [0, 0]
        if won >= self.target:
            pts[holder_team] = self.target          # success: their team gets the target
        else:
            pts[1 - holder_team] = 2 * self.target  # failed: the other team gets double
        self.round_points = pts
        self.points[0] += pts[0]
        self.points[1] += pts[1]

        team_name = "Team A" if holder_team == 0 else "Team B"
        self.message = f"Round {self.round}: {team_name} won {won} of {self.target} tricks"

        # The first team to reach the winning score wins the game
        if max(self.points) >= self.winning_score:
            self.match_over = True
            self.winner_team = 0 if self.points[0] >= self.points[1] else 1
            winner = "Team A" if self.winner_team == 0 else "Team B"
            self.message = f"Game over! {winner} wins"

    def next_round(self):
        """The host starts the next round, if the last one is finished and the game is not over."""
        if self.round_over and not self.match_over:
            self.deal_round()

    # ---------- the bots (aggressive) ----------

    def estimate_tricks(self, seat):
        """A rough guess: how many tricks can this hand win with its best suit?
        Each Ace or King counts as one trick, and each card above 3 in a suit adds one."""
        best = 0
        for suit in SUITS:
            cards = [c for c in self.hands[seat] if suit_of(c) == suit]
            top = sum(1 for c in cards if rank_of(c) in ("A", "K"))
            best = max(best, top + max(0, len(cards) - 3))
        return best

    def suit_strength(self, seat, suit):
        """How good a suit is as trump: more cards and more A and K is better."""
        cards = [c for c in self.hands[seat] if suit_of(c) == suit]
        top = sum(1 for c in cards if rank_of(c) in ("A", "K"))
        return len(cards) + 2 * top

    def bot_move(self, seat):
        """An aggressive bot. It bids boldly, leads high and wins tricks when it can."""
        moves = self.legal_moves(seat)

        if self.phase == "score":
            return "50"

        if self.phase == "bid":
            # Bold: it bids up to one trick more than its hand can win
            est = self.estimate_tricks(seat) + 1
            raises = [m for m in moves if m != "pass"]
            can_bid = [m for m in raises if int(m) <= est]
            return str(max(can_bid, key=int)) if can_bid else "pass"

        if self.phase == "trump":
            # Choose the suit that gives the most strength
            return max(moves, key=lambda s: self.suit_strength(seat, s))

        # Playing a card
        if not self.trick:
            return max(moves, key=power)  # leading: play the strongest card

        lead = suit_of(self.trick[0][1])
        win_seat, win_code = max(
            self.trick, key=lambda item: card_strength(item[1], lead, self.trump)
        )
        now = card_strength(win_code, lead, self.trump)

        # My partner is already winning: do not waste a strong card, drop the lowest
        if win_seat == (seat + 2) % 4:
            return min(moves, key=power)

        # Otherwise play the CHEAPEST card that beats the table (trump if needed)
        winning = [c for c in moves if card_strength(c, lead, self.trump) > now]
        if winning:
            return min(winning, key=lambda c: card_strength(c, lead, self.trump))

        # Cannot win this trick: throw away the lowest card
        return min(moves, key=power)

    # ---------- what each player's screen gets ----------

    def state_for(self, seat):
        """Each player sees only their OWN cards. Other players' cards stay hidden."""
        return {
            "phase": self.phase,
            "turn": self.turn,
            "my_hand": list(self.hands[seat]),
            "hand_sizes": [len(h) for h in self.hands],
            "my_moves": self.legal_moves(seat),
            "trick": [{"seat": s, "card": c} for s, c in self.trick],
            "last_trick": self.last_trick,
            "last_winner": self.last_winner,
            "tricks_done": self.tricks_done,
            "tricks_won": self.tricks_won,
            "points": self.points,
            "round_points": self.round_points,
            "round": self.round,
            "dealer": self.dealer,
            "winning_score": self.winning_score,
            "sarkari": self.sarkari,              # starts the first trick
            "target_holder": self.target_holder,  # chooses trump
            "target": self.target,
            "trump": self.trump,
            "bid_value": self.bid_value,
            "highest": self.highest,
            "active": self.active,
            "round_over": self.round_over,
            "match_over": self.match_over,
            "winner_team": self.winner_team,
            "message": self.message,
        }