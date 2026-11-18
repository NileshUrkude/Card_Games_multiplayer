import Card from "./Card";
import { slotOf } from "./seatMath";

// Where each name sits on the table. Left and right players sit at mid-height,
// so the top players never overlap them on a small phone screen.
const POS = {
  top: "top-2 left-1/2 -translate-x-1/2",
  topLeft: "top-2 left-[30%] -translate-x-1/2",
  topRight: "top-2 left-[70%] -translate-x-1/2",
  left: "left-0 top-[30%]",
  right: "right-0 top-[30%]",
};

// Left and right players show their folded cards sideways, in a column
const SIDE = ["left", "right"];

// Name label. Yellow when it is that player's turn.
// stack = name and info on two lines (used for left/right players).
export function PlayerTag({ name, active, info, stack = false }) {
  const color = active ? "bg-yellow-300 text-black" : "bg-black/40 text-white";
  if (stack) {
    return (
      <div className={"rounded-lg px-2 py-0.5 text-xs font-semibold " + color}>
        <div>{name}</div>
        <div className="text-[10px] font-normal">{info}</div>
      </div>
    );
  }
  return (
    <div className={"inline-block rounded-full px-3 py-0.5 text-xs font-semibold " + color}>
      {name}
      {info ? ` · ${info}` : ""}
    </div>
  );
}

// Face-down cards of an opponent, overlapped
function FoldedHand({ count, sideways }) {
  const cards = Array.from({ length: count }, (_, i) => i);
  if (sideways) {
    return (
      <div className="mt-1 flex flex-col items-center">
        {cards.map((i) => (
          <Card key={i} back sideways size="xs" style={{ marginTop: i === 0 ? 0 : -18 }} />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-1 flex justify-center">
      {cards.map((i) => (
        <Card key={i} back size="xs" style={{ marginLeft: i === 0 ? 0 : -22 }} />
      ))}
    </div>
  );
}

// hands    = cards left per seat
// info     = small text per seat (inside the name label)
// status   = text under the name per seat, like "Pass" (optional)
// bottom   = my own name and cards (shown inside the table)
// children = middle of the table
// height   = table height. It shrinks on short phone screens (never taller than 62% of the screen).
export default function TableSeats({
  names, mySeat, hands, turn, info, status,
  height = "h-[min(26rem,62vh)]", bottom, children,
}) {
  return (
    <div className={"relative w-full rounded-3xl bg-green-800 shadow-inner " + height}>
      {names.map((name, seat) => {
        if (seat === mySeat) return null; // I sit at the bottom
        const slot = slotOf(seat, mySeat, names.length);
        const side = SIDE.includes(slot);
        return (
          <div key={seat} className={"absolute text-center " + POS[slot]}>
            <PlayerTag name={name} active={turn === seat} info={info[seat]} stack={side} />
            {status && status[seat] && (
              <div className="mt-0.5 text-[11px] font-bold text-yellow-200">{status[seat]}</div>
            )}
            <FoldedHand count={hands[seat]} sideways={side} />
          </div>
        );
      })}

      {children}

      {/* My own name and cards, inside the table at the bottom */}
      {bottom && <div className="absolute inset-x-2 bottom-2">{bottom}</div>}
    </div>
  );
}