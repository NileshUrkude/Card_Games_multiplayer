import Card from "../../components/Card";
import FlyIn from "../../components/FlyIn";
import Hand from "../../components/Hand";
import ResultOverlay from "../../components/ResultOverlay";
import TableSeats, { FLY, PlayerTag, slotOf } from "../../components/TableSeats";

const SUITS = ["♠", "♥", "♣", "♦"];
const FACE = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const codeOf = (value, suit) => (FACE[value] || value) + suit; // 12, "♥" → "Q♥"

const STEP = 16;        // how much of each card stays visible in a stack
const CARD_H = 56;      // height of a "sm" card
const SPAN = 6 * STEP;  // room for 6 cards above and 6 below the 7

// One suit's column: the 7 in the middle, 8..K going up, 6..A going down
function SuitColumn({ suit, row, playedBy, mySeat, total }) {
  const red = suit === "♥" || suit === "♦";
  // Values on the table in this suit, like [5, 6, 7, 8]
  const values = row
    ? Array.from({ length: row.high - row.low + 1 }, (_, i) => row.low + i)
    : [];

  return (
    <div className="relative w-10" style={{ height: CARD_H + 2 * SPAN }}>
      {/* Empty slot for the 7, until it is played */}
      <div
        className={
          "absolute flex h-14 w-10 items-center justify-center rounded-md border-2 border-dashed border-green-400 text-xl " +
          (red ? "text-red-300" : "text-white/70")
        }
        style={{ top: SPAN }}
      >
        {suit}
      </div>

      {values.map((v) => {
        const code = codeOf(v, suit);
        const seat = playedBy[code];
        // The card flies in from the player who played it
        const from = seat === undefined ? [0, 0] : FLY[slotOf(seat, mySeat, total)];
        return (
          <div
            key={v}
            className="absolute"
            // 7 sits at SPAN. Bigger cards go up, smaller cards go down.
            // zIndex makes the corner of every card visible.
            style={{ top: SPAN + (7 - v) * STEP, zIndex: 20 + (7 - v) }}
          >
            <FlyIn from={from}>
              <Card code={code} size="sm" inline />
            </FlyIn>
          </div>
        );
      })}
    </div>
  );
}

export default function SatteTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;
  // Yellow tag: my turn, or the 1 second right after I played
  const meActive = gs.turn === me && !gs.round_over;

  // Result card rows. Round: the player who finished first (0 points) is highlighted.
  // Match end: the winners are highlighted.
  const rows = names.map((n, i) => ({
    name: n,
    you: i === me,
    detail: `+${gs.round_points[i]} pts`,
    total: gs.scores[i],
    good: gs.match_over ? gs.winners.includes(i) : gs.round_points[i] === 0,
  }));
  const winnerNames = gs.winners.map((i) => names[i]).join(", ");
  const title = gs.match_over
    ? gs.winners.includes(me)
      ? "🏆 You win the match!"
      : `${winnerNames} won the match`
    : `Round ${gs.round} finished`;

  return (
    <div>
      <p className="mb-2 font-semibold">
        Round {gs.round} of {gs.total_rounds}
      </p>
      <p className="mb-2 rounded bg-yellow-100 p-2 text-sm">{gs.message}</p>

      <TableSeats
        names={names}
        mySeat={me}
        hands={gs.hand_sizes}
        turn={gs.round_over ? null : gs.turn}
        info={gs.scores.map((s) => `${s} pts`)}
        status={gs.status}
        height="h-[34rem]"
        bottom={
          <div className="text-center">
            <PlayerTag name={names[me] + " (you)"} active={meActive} info={`${gs.scores[me]} pts`} />
            {gs.status[me] && (
              <div className="mt-0.5 text-[11px] font-bold text-yellow-200">{gs.status[me]}</div>
            )}

            {gs.can_pass ? (
              // No valid card: the only move is Pass
              <button
                onClick={() => send({ action: "pass" })}
                className="mt-1 rounded bg-red-600 px-5 py-1 text-sm font-semibold text-white"
              >
                No valid card: Pass
              </button>
            ) : (
              <p className="mt-1 text-xs text-white/80">
                {gs.my_moves.length > 0 ? "Your turn: tap a green card" : "Your cards"}
              </p>
            )}

            <Hand
              cards={gs.my_hand}
              playable={gs.my_moves}
              onPlay={(card) => send({ action: "play", card })}
            />
          </div>
        }
      >
        {/* Cards on the table: one column per suit, the 7s form the middle row */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2">
          {SUITS.map((suit) => (
            <SuitColumn
              key={suit}
              suit={suit}
              row={gs.layout[suit]}
              playedBy={gs.played_by}
              mySeat={me}
              total={names.length}
            />
          ))}
        </div>

        {/* Result pop-up when the round or match ends */}
        {gs.round_over && (
          <ResultOverlay
            title={title}
            subtitle={gs.match_over ? "Lowest total points wins" : gs.message}
            rows={rows}
            matchOver={gs.match_over}
            isHost={room.is_host}
            onNext={() => send({ action: "next_round" })}
          />
        )}
      </TableSeats>
    </div>
  );
}