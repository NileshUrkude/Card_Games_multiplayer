import { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { FLY, OFFSET_PX, slotOf } from "./TableSeats";

// One card on the table. It moves with a smooth transition.
//   enter = starts at the player's seat and flies to the middle
//   away  = slot of the trick winner; the card slides there and fades
function Spot({ seat, code, mySeat, total, enter = false, away = null }) {
  const [landed, setLanded] = useState(!enter);

  // Wait a moment after the first draw, then move the card to the middle
  useEffect(() => {
    if (!landed) {
      const id = setTimeout(() => setLanded(true), 30);
      return () => clearTimeout(id);
    }
  }, [landed]);

  const slot = slotOf(seat, mySeat, total);
  let [x, y] = OFFSET_PX[slot]; // resting place
  let opacity = 1;
  if (!landed) {
    [x, y] = FLY[slot];         // start: at the player
    opacity = 0;
  }
  if (away) {
    [x, y] = FLY[away];         // end: at the winner
    opacity = 0;
  }

  return (
    <div
      // Tailwind keeps the card floating in place while the transform moves it.
      className="absolute transition-all duration-500 ease-out"
      style={{ left: -22, top: -32, opacity, transform: `translate(${x}px, ${y}px)` }}
    >
      <Card code={code} size="md" />
    </div>
  );
}

export default function TrickArea({ trick, lastTrick, lastWinner, tricksDone, mySeat, total }) {
  const [sweep, setSweep] = useState(null);   // the finished trick, on its way to the winner
  const seen = useRef(tricksDone);

  // When a trick finishes: keep its cards 1.5 sec, then slide them to the winner
  useEffect(() => {
    if (tricksDone > seen.current) {
      setSweep({ cards: lastTrick, winner: lastWinner, moving: false });
      const t1 = setTimeout(() => setSweep((s) => s && { ...s, moving: true }), 100);
      const t2 = setTimeout(() => setSweep(null), 800);
      seen.current = tricksDone;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    seen.current = tricksDone;
  }, [tricksDone]); // eslint-disable-line

  const winnerSlot = sweep && slotOf(sweep.winner, mySeat, total);

  return (
    <div
      // Tailwind keeps the card area in the center of the table without blocking clicks.
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div
        // The relative wrapper gives each card a coordinate system inside the table center.
        className="relative"
      >
        {/* cards of the trick being played now */}
        {trick.map((t) => (
          <Spot key={t.card} seat={t.seat} code={t.card} mySeat={mySeat} total={total} enter />
        ))}

        {/* the finished trick: only the newest card flies in, the others are already there */}
        {sweep &&
          sweep.cards.map((t) => (
            <Spot
              key={"done" + t.card}
              seat={t.seat}
              code={t.card}
              mySeat={mySeat}
              total={total}
              away={sweep.moving ? winnerSlot : null}
            />
          ))}
      </div>
    </div>
  );
}