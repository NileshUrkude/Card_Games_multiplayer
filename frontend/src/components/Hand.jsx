import Card from "./Card";

const SUIT_ORDER = ["♠", "♥", "♣", "♦"];
const BASE = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const ACE_LOW = ["A", ...BASE]; // Satte pe Satta
const ACE_HIGH = [...BASE, "A"]; // 5-3-2

const split = (code) => ({ rank: code.slice(0, -1), suit: code.slice(-1) });

export default function Hand({ cards, aceHigh = false, playable = [], onPlay }) {
  const ranks = aceHigh ? ACE_HIGH : ACE_LOW;
  const myTurn = playable.length > 0; // the server sends moves only on my turn

  // Put cards in a consistent order so the hand always looks familiar.
  const sorted = [...cards].sort((a, b) => {
    const A = split(a);
    const B = split(b);
    if (A.suit !== B.suit) return SUIT_ORDER.indexOf(A.suit) - SUIT_ORDER.indexOf(B.suit);
    return ranks.indexOf(A.rank) - ranks.indexOf(B.rank);
  });

  return (
    // One row, side by side. Each card shrinks a little so all fit on the screen.
    <div className="flex justify-center gap-0.5 pt-3">
      {sorted.map((code) => {
        const canPlay = playable.includes(code);
        return (
          <div key={code} className="min-w-0 flex-1" style={{ maxWidth: 44 }}>
            <Card
              code={code}
              fill
              playable={canPlay}
              dim={myTurn && !canPlay}
              onClick={canPlay ? () => onPlay(code) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}