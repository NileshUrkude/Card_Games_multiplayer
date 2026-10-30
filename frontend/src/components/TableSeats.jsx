import Card from "./Card";

// Opponents are laid out around the table in clockwise order from the player's perspective.
// The current seat is always the bottom slot, and the rest wrap around the table.
const SLOTS = {
  1: ["top"],
  2: ["topRight", "topLeft"],
  3: ["right", "top", "left"],
  4: ["right", "topRight", "topLeft", "left"],
};

// CSS position for each seat on the board.
const POS = {
  top: "top-2 left-1/2 -translate-x-1/2",
  topLeft: "top-2 left-[26%] -translate-x-1/2",
  topRight: "top-2 left-[74%] -translate-x-1/2",
  left: "left-1 top-1/2 -translate-y-1/2",
  right: "right-1 top-1/2 -translate-y-1/2",
};

// Left and right players show their folded cards sideways, in a column
const SIDE = ["left", "right"];

// Where a played card rests in the middle of the table (x, y in pixels),
// a little toward the player who played it
export const OFFSET_PX = {
  bottom: [0, 40], top: [0, -40], left: [-50, 0], right: [50, 0],
  topLeft: [-38, -28], topRight: [38, -28],
};

// Where a card starts from (the player's seat). Also where the winner's cards go.
export const FLY = {
  bottom: [0, 170], top: [0, -150], left: [-170, 0], right: [170, 0],
  topLeft: [-120, -150], topRight: [120, -150],
};

// Which slot does this seat sit in, seen from my seat?
export function slotOf(seat, mySeat, total) {
  const step = (seat - mySeat + total) % total; // 0 = me
  return step === 0 ? "bottom" : SLOTS[total - 1][step - 1];
}

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

// hands  = cards left per seat
// info   = small text per seat (inside the name label)
// status = text under the name per seat, like "Pass" (optional)
// bottom = my own name and cards (shown inside the table)
// children = middle of the table
export default function TableSeats({
  names, mySeat, hands, turn, info, status, height = "h-[26rem]", bottom, children,
}) {
  return (
    <div className={"relative rounded-3xl bg-green-800 shadow-inner " + height}>
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