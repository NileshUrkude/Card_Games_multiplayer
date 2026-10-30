import random

SUITS = ["♠", "♥", "♦", "♣"]
# Number value of face cards (used for sequence and scoring)
FACE_VALUES = {"A": 1, "J": 11, "Q": 12, "K": 13}

class Card:
    def __init__(self, rank, suit):
        self.rank = rank  # "A", "2" ... "10", "J", "Q", "K"
        self.suit = suit  # "♠", "♥", "♦", "♣"

    @property
    def code(self):
        """Text sent to the browser, like 7♥."""
        return f"{self.rank}{self.suit}"

    @property
    def value(self):
        """A=1, 2-10 face value, J=11, Q=12, K=13."""
        return FACE_VALUES.get(self.rank) or int(self.rank)
    
    def __repr__(self):
        return self.code



def full_deck():
    """Normal 52 cards (Satte pe Satta)."""
    ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    return [Card(r, s) for s in SUITS for r in ranks]


def five_three_two_deck():
    """30 cards: A K Q J 10 9 8 of all suits, plus the 7 of hearts and spades."""
    ranks = ["A", "K", "Q", "J", "10", "9", "8"]
    cards = [Card(r, s) for s in SUITS for r in ranks]
    cards += [Card("7", "♥"), Card("7", "♠")]
    return cards


def shuffle_and_deal(cards, players):
    """Shuffle, then deal one card at a time around the table.
    If cards don't divide evenly, the first players get one extra."""
    cards = list(cards)
    random.shuffle(cards)
    hands = [[] for _ in range(players)]
    for i, card in enumerate(cards):
        hands[i % players].append(card)
    return hands