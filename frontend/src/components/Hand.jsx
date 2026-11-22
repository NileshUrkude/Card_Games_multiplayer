import { useEffect, useRef, useState } from "react";
import Card from "./Card";

const SUIT_ORDER = ["♠", "♥", "♣", "♦"];
const BASE = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const ACE_LOW = ["A", ...BASE];   // Satte pe Satta
const ACE_HIGH = [...BASE, "A"];  // 5-3-2 and Court

const split = (code) => ({ rank: code.slice(0, -1), suit: code.slice(-1) });

// cards     = the cards in my hand
// aceHigh   = which order the ranks use
// playable  = cards I may play now (they lift up with a green border)
// highlight = cards to glow (for example, a card just taken in 5-3-2)
// onPlay    = called with the card code when a playable card is tapped
// overlap   = true: cards overlap, and the hand is kept in the middle of the row
// big       = true: bigger cards (used with overlap)
export default function Hand({
  cards, aceHigh = false, playable = [], highlight = [], onPlay,
  overlap = false, big = false,
}) {
  const ranks = aceHigh ? ACE_HIGH : ACE_LOW;
  const myTurn = playable.length > 0; // the server sends moves only on my turn

  // The width of the row on screen, measured so the hand fits any phone
  const rowRef = useRef(null);
  const [rowWidth, setRowWidth] = useState(0);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const watcher = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width));
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);

  // Sort by suit order, then by rank
  const sorted = [...cards].sort((a, b) => {
    const A = split(a);
    const B = split(b);
    if (A.suit !== B.suit) return SUIT_ORDER.indexOf(A.suit) - SUIT_ORDER.indexOf(B.suit);    return ranks.indexOf(A.rank) - ranks.indexOf(B.rank);
  });

  if (overlap) {
    const cardW = big ? 56 : 44;     // width of one card, in pixels
    const cardH = (cardW * 7) / 5;   // playing cards are 5 wide and 7 tall
    const n = sorted.length;

    // How far each card sits from the one before it:
    // - half a card when the hand is crowded (the cards overlap by half)
    // - a little more when there are few cards, but never a big gap
    const half = cardW / 2;
    const spread = n > 1 && rowWidth > 0 ? (rowWidth - cardW) / (n - 1) : half;
    const step = Math.max(half, Math.min(spread, cardW * 0.8));

    // Total width of the hand. If it is narrower than the row, it is centred.
    const handWidth = cardW + step * Math.max(0, n - 1);

    return (
      <div
        ref={rowRef}
        className="w-full overflow-x-auto pb-1 pt-4"
        style={{ height: cardH + 24 }}
      >
        <div
          className="relative mx-auto"
          style={{ width: handWidth, height: cardH }}
        >
          {sorted.map((code, i) => {
            const canPlay = playable.includes(code);
            const isNew = highlight.includes(code);
            return (
              <div
                key={code}
                // Each card slides to its new place when the hand changes
                className="absolute top-0 transition-all duration-300 ease-out"
                style={{ width: cardW, left: i * step }}
              >
                {isNew && (
                  <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded bg-yellow-400 px-1 text-[9px] font-bold text-black">
                    NEW
                  </span>
                )}
                <Card
                  code={code}
                  fill
                  highlight={isNew}
                  playable={canPlay}
                  dim={myTurn && !canPlay}
                  onClick={canPlay ? () => onPlay(code) : undefined}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default mode: one row, side by side, shrinking to fit the screen
  return (
    <div className="flex justify-center gap-0.5 pt-4">
      {sorted.map((code) => {
        const canPlay = playable.includes(code);
        const isNew = highlight.includes(code);
        return (
          <div key={code} className="relative min-w-0 flex-1" style={{ maxWidth: 44 }}>
            {isNew && (
              <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded bg-yellow-400 px-1 text-[9px] font-bold text-black">
                NEW
              </span>
            )}
            <Card
              code={code}
              fill
              highlight={isNew}
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