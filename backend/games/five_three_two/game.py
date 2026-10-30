import random

from core.base_game import BaseGame
from core.cards import SUITS, five_three_two_deck

RANKS = ["7", "8", "9", "10", "J", "Q", "K", "A"]  # low to high (A is highest)
TOTAL_ROUNDS = 6  # change this to play a longer or shorter match


def exchange_pairs(diffs):
    """Decide who takes cards from whom after a round.
    diffs[seat] = tricks won minus target.
    Returns a list of (taker, giver, number_of_cards)."""
    # Players who beat their target give away cards to those who fell short.
    takers = [[s, d] for s, d in enumerate(diffs) if d > 0]    # won extra tricks
    givers = [[s, -d] for s, d in enumerate(diffs) if d < 0]   # fell short
    pairs = []
    for taker in takers:
        for giver in givers:
            n = min(taker[1], giver[1])
            if n > 0:
                pairs.append((taker[0], giver[0], n))
                taker[1] -= n
                giver[1] -= n
    return pairs


class FiveThreeTwoGame(BaseGame):
    def name(self, seat):
        return self.seats[seat]["name"]

    # ---------- setting up ----------
    def start(self):
        self.scores = [0, 0, 0]
        self.round = 0
        self.round_over = False
        self.match_over = False
        self.pending_diffs = None  # last round's (tricks - target), for the exchange
        self.message = ""
        # Roles: dealer has target 2, selector (chooses trump) 5, other 3
        self.dealer = random.randrange(3)
        self.selector = (self.dealer + 1) % 3
        self.other = (self.dealer + 2) % 3
        self.next_round()

    def next_round(self):
        if self.round > 0 and (not self.round_over or self.match_over):
            return  # can't start a new round before this one is finished
        if self.round > 0:
            # Rotate roles so each player gets a different target each round.
            self.dealer, self.selector, self.other = self.selector, self.other, self.dealer

        self.round += 1
        self.round_over = False
        self.targets = [0, 0, 0]
        self.targets[self.dealer] = 2
        self.targets[self.selector] = 5
        self.targets[self.other] = 3

        # Deal 5 cards each now. The other 15 wait until trump is chosen.
        deck = five_three_two_deck()
        random.shuffle(deck)
        self.hands = [deck[i * 5:(i + 1) * 5] for i in range(3)]
        self.stock = deck[15:]

        self.trump = None
        self.trick = []         # cards on the table now: (seat, Card)
        self.last_trick = []    # the previous trick, used for the slide to the winner
        self.last_winner = None
        self.tricks_won = [0, 0, 0]
        self.round_diffs = []

        # The pause after a play (see advance() below)
        self.hold = False       # True while we wait: nobody can play
        self.hold_for = 1.0     # how many seconds the wait lasts
        self.sweeping = False   # True while the finished trick slides to the winner

        # The card exchange comes from the last round's result
        self.exchange_pairs = exchange_pairs(self.pending_diffs) if self.pending_diffs else []
        self.pending_diffs = None
        self.left = 0           # cards still to swap with the current giver
        self.grabbed = None     # code of the card just picked from a giver (taker only)
        self.notices = [[], [], []]   # private messages per seat, like "Bot 1 took your 9♥"

        self.phase = "trump"    # trump -> pick -> return -> (pick -> return ...) -> play
        self.turn = self.selector
        self.message = f"Round {self.round}: {self.name(self.selector)} chooses trump"

    # ---------- what a seat may do ----------
    def legal_moves(self, seat):
        if seat != self.turn or self.round_over or self.hold:
            return []                                # not my turn, or we are waiting
        hand = self.hands[seat]
        if self.phase == "trump":
            return list(SUITS)                       # pick one of 4 suits
        if self.phase == "pick":
            # The taker picks one of the giver's face-down cards by its position: "0", "1", ...
            giver = self.exchange_pairs[0][1]
            return [str(i) for i in range(len(self.hands[giver]))]
        if self.phase == "return" or not self.trick:
            return [c.code for c in hand]            # any card
        led = self.trick[0][1].suit                  # suit of the first card
        same_suit = [c.code for c in hand if c.suit == led]
        # Have the led suit: you must follow it. No led suit: ANY card (trump is not forced).
        return same_suit or [c.code for c in hand]

    def find_card(self, seat, code):
        return next(c for c in self.hands[seat] if c.code == code)

    def apply_move(self, seat, move):
        if move not in self.legal_moves(seat):
            return False
        if self.phase == "trump":
            self.choose_trump(move)
        elif self.phase == "pick":
            self.pick_card(seat, int(move))
        elif self.phase == "return":
            self.give_back(seat, move)
        else:
            self.play_card(seat, move)
        return True

    # ---------- phase 1: trump ----------
    def choose_trump(self, suit):
        self.trump = suit
        # Deal the remaining 15 cards, one at a time: 5 more each
        for i, card in enumerate(self.stock):
            self.hands[i % 3].append(card)
        self.stock = []
        self.message = f"{self.name(self.selector)} chose {suit} as trump"
        self.start_next_exchange()

    # ---------- phase 2: card exchange ----------
    def start_next_exchange(self):
        """Start the next taker/giver pair, or begin playing if all are done."""
        if not self.exchange_pairs:
            # When the card swap is complete, the round begins for real.
            self.phase = "play"
            self.turn = self.selector  # trump selector leads the first trick
            self.message += f". {self.name(self.selector)} leads"
            return
        taker, giver, n = self.exchange_pairs[0]
        self.left = n               # one pick + one return for every extra trick
        self.phase = "pick"
        self.turn = taker
        self.message = (f"{self.name(taker)} won extra tricks: "
                        f"picks a card blindly from {self.name(giver)}")

    def pick_card(self, seat, index):
        """The taker blindly picks one face-down card (by position) from the giver."""
        taker, giver, n = self.exchange_pairs[0]
        card = self.hands[giver].pop(index)
        self.grabbed = card.code    # remember it so the taker's screen can highlight it
        # tell the giver (and only the giver) which card was taken
        self.notices[giver].append(f"{self.name(taker)} took your {card.code}")
        self.hands[taker].append(card)
        self.phase = "return"       # now the taker must give one card back
        self.message = (f"{self.name(taker)} picked a card from {self.name(giver)} "
                        f"and gives one back")

    def give_back(self, seat, code):
        taker, giver, n = self.exchange_pairs[0]
        card = self.find_card(seat, code)
        self.hands[taker].remove(card)
        self.hands[giver].append(card)
        self.grabbed = None         # a card was returned: the highlight goes away
        # add the returned card to the giver's message
        self.notices[giver][-1] += f" and gave you {code}"
        self.left -= 1
        if self.left == 0:                  # done with this giver
            self.exchange_pairs.pop(0)
            self.start_next_exchange()      # next pair, or start playing
        else:                               # one more card to swap with the same giver
            self.phase = "pick"
            self.message = f"{self.name(taker)} picks another card from {self.name(giver)}"

    # ---------- phase 3: playing tricks ----------
    def play_card(self, seat, code):
        card = self.find_card(seat, code)
        self.hands[seat].remove(card)
        self.trick.append((seat, card))
        self.message = f"{self.name(seat)} played {code}"

        # Every card (yours, a friend's or a bot's) stays on screen for a moment.
        # Then advance() gives the turn to the next player, or finishes the trick
        # if this was the third card (the 3 cards then slide to the winner).
        self.hold = True
        self.hold_for = 1.5   # about 0.5 sec for the card to land + 1 sec to look

    def advance(self):
        """Called after the wait is over. Moves the game to its next step."""
        if not self.hold:
            return
        self.hold = False
        self.notices = [[], [], []]    # play has started: the "took your card" messages go away
        if self.sweeping:              # the cards reached the winner: the winner leads now
            self.sweeping = False
        elif len(self.trick) == 3:     # 3 cards on the table: decide the trick
            self.finish_trick()
        else:                          # next player's turn
            self.turn = (self.turn + 1) % 3

    def finish_trick(self):
        # The trick is over; the best card wins and leads the next round.
        winner = self.trick_winner()
        self.tricks_won[winner] += 1
        self.last_winner = winner
        self.last_trick = [{"seat": s, "card": c.code} for s, c in self.trick]
        self.trick = []
        self.turn = winner               # winner leads next
        if not self.hands[0]:            # all 10 tricks played
            self.finish_round()
            return
        self.message = f"{self.name(winner)} won the trick"
        # Wait while the 3 cards slide to the winner, then the winner leads
        self.sweeping = True
        self.hold = True
        self.hold_for = 0.9

    def trick_winner(self):
        led = self.trick[0][1].suit

        def strength(item):
            card = item[1]
            # Higher priority wins: trump > led suit > other suits.
            if card.suit == self.trump:
                return (2, RANKS.index(card.rank))  # trump beats everything
            if card.suit == led:
                return (1, RANKS.index(card.rank))  # then the led suit
            return (0, 0)                           # other suits never win

        return max(self.trick, key=strength)[0]

    # ---------- scoring ----------
    def finish_round(self):
        self.round_over = True
        # Score = tricks won minus target (extra tricks +, short tricks -)
        self.round_diffs = [self.tricks_won[s] - self.targets[s] for s in range(3)]
        for s in range(3):
            self.scores[s] += self.round_diffs[s]
        self.pending_diffs = self.round_diffs   # used for next round's exchange
        self.match_over = self.round >= TOTAL_ROUNDS
        self.message = "Round finished!"

    def is_over(self):
        return self.match_over

    def winners(self):
        best = max(self.scores)  # highest total wins
        return [s for s in range(3) if self.scores[s] == best]

    # ---------- bot ----------
    def bot_move(self, seat):
        moves = self.legal_moves(seat)
        if self.phase == "trump":
            # Choose the suit the bot holds the most cards of
            counts = {s: sum(1 for c in self.hands[seat] if c.suit == s) for s in moves}
            return max(counts, key=counts.get)
        if self.phase == "return":
            # Give back the weakest card: not trump first, then the lowest rank
            return min(moves, key=lambda c: (c[-1] == self.trump, RANKS.index(c[:-1])))
        return random.choice(moves)   # picking a blind card, or playing a card

    # ---------- what each player sees ----------
    def state_for(self, seat):
        state = super().state_for(seat)  # my_hand + hand_sizes
        in_exchange = self.phase in ("pick", "return")
        state.update({
            "phase": self.phase,
            "turn": self.turn,
            "my_moves": self.legal_moves(seat),
            "trump": self.trump,
            "targets": self.targets,
            "tricks_won": self.tricks_won,
            "trick": [{"seat": s, "card": c.code} for s, c in self.trick],
            "last_trick": self.last_trick,
            "last_winner": self.last_winner,
            "tricks_done": sum(self.tricks_won),  # lets the screen detect a finished trick
            # who is taking from whom (only during the exchange)
            "exchange": {
                "taker": self.exchange_pairs[0][0],
                "giver": self.exchange_pairs[0][1],
                "left": self.left,
            } if in_exchange else None,
            # only the player who picked the card sees which one it is
            "grabbed": self.grabbed if self.phase == "return" and seat == self.turn else None,
            "notices": self.notices[seat],   # only my own messages
            "scores": self.scores,
            "round": self.round,
            "total_rounds": TOTAL_ROUNDS,
            "round_over": self.round_over,
            "round_diffs": self.round_diffs,
            "match_over": self.match_over,
            "winners": self.winners() if self.match_over else [],
            "message": self.message,
        })
        return state