// Suit order shown on screen: spades, hearts, clubs, diamonds
const SUIT_ORDER = ["♠", "♥", "♣", "♦"];

// Highest card first inside each suit
const RANK_ORDER = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

// A card code looks like "10♠": the last character is the suit, the rest is the rank
export const suitOf = (code) => code.slice(-1);
export const rankOf = (code) => code.slice(0, -1);

// Returns a sorted copy of the hand: by suit first, then by rank
export function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const bySuit = SUIT_ORDER.indexOf(suitOf(a)) - SUIT_ORDER.indexOf(suitOf(b));
    if (bySuit !== 0) return bySuit;
    return RANK_ORDER.indexOf(rankOf(a)) - RANK_ORDER.indexOf(rankOf(b));
  });
}