// Helper numbers and functions for seat positions on the table.
// They live in their own file (not in a component file), so React's
// fast-refresh rule stays happy.

// Order of the opponent slots, by how many opponents there are.
// Anticlockwise: after me, the player on my RIGHT goes next.
export const SLOTS = {
  1: ["top"],
  2: ["topRight", "topLeft"],
  3: ["right", "top", "left"],
  4: ["right", "topRight", "topLeft", "left"],
};

// Where a played card rests in the middle of the table (x, y in pixels),
// a little toward the player who played it
export const OFFSET_PX = {
  bottom: [0, 40], top: [0, -40], left: [-50, 0], right: [50, 0],
  topLeft: [-38, -28], topRight: [38, -28],
};

// Where a card starts from (the player's seat). Smaller values fit a phone screen.
export const FLY = {
  bottom: [0, 140], top: [0, -120], left: [-120, 0], right: [120, 0],
  topLeft: [-90, -120], topRight: [90, -120],
};

// Which slot does this seat sit in, seen from my seat?
// seat = the player we are asking about, mySeat = me, total = number of players
export function slotOf(seat, mySeat, total) {
  const step = (seat - mySeat + total) % total; // 0 = me
  return step === 0 ? "bottom" : SLOTS[total - 1][step - 1];
}