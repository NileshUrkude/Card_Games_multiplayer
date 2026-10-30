import Card from "../../components/Card";
import Hand from "../../components/Hand";
import ResultOverlay from "../../components/ResultOverlay";
import TableSeats, { PlayerTag } from "../../components/TableSeats";
import TrickArea from "../../components/TrickArea";

const SUITS = ["♠", "♥", "♣", "♦"];
const isRed = (text) => text.includes("♥") || text.includes("♦");

export default function FiveThreeTwoTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;

  // What am I being asked to do right now?
  const chooseTrump = gs.phase === "trump" && gs.my_moves.length > 0;
  const pickCard = gs.phase === "pick" && gs.my_moves.length > 0;     // blind pick
  const giveBack = gs.phase === "return" && gs.my_moves.length > 0;   // give one card back
  const myTurn = gs.my_moves.length > 0;
  const meActive = gs.turn === me && !gs.round_over;
  const play = (card) => send({ action: "play", card });

  // Small text next to each name: target and tricks won
  const info = names.map((_, i) => `T${gs.targets[i]} · won ${gs.tricks_won[i]}`);

  // Result card rows. Round: everyone who met or beat their target is highlighted.
  // Match end: the winners are highlighted.
  const rows = names.map((n, i) => ({
    name: n,
    you: i === me,
    detail: `won ${gs.tricks_won[i]} of ${gs.targets[i]} → ${gs.round_diffs[i] > 0 ? "+" : ""}${gs.round_diffs[i]}`,
    total: gs.scores[i],
    good: gs.match_over ? gs.winners.includes(i) : gs.round_diffs[i] >= 0,
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
        info={info}
        bottom={
          <div className="text-center">
            <PlayerTag name={names[me] + " (you)"} active={meActive} info={info[me]} />
            {/* Private messages: which of my cards were taken */}
            {gs.notices.map((text, i) => (
              <p
                key={i}
                className="mx-auto mt-1 w-fit rounded bg-yellow-200 px-2 py-0.5 text-xs font-semibold text-black"
              >
                {text}
              </p>
            ))}
            <p className="mt-1 text-xs text-white/80">
              {giveBack
                ? "Tap 1 card from your hand to give back"
                : pickCard
                ? "Pick a face-down card on the table"
                : myTurn && !chooseTrump
                ? "Your turn: tap a green card"
                : "Your cards"}
            </p>
            <Hand
              cards={gs.my_hand}
              aceHigh
              highlight={gs.grabbed ? [gs.grabbed] : []}
              playable={chooseTrump || pickCard ? [] : gs.my_moves}
              onPlay={play}
            />
          </div>
        }
      >
        {/* Cards played in the middle: fly in, then slide to the trick winner */}
        <TrickArea
          trick={gs.trick}
          lastTrick={gs.last_trick}
          lastWinner={gs.last_winner}
          tricksDone={gs.tricks_done}
          mySeat={me}
          total={names.length}
        />

        {/* Trump suit, on the left side of the table */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-white px-2 py-1 text-xs font-semibold">
          Trump
          <div className={"text-center text-xl " + (gs.trump && isRed(gs.trump) ? "text-red-600" : "")}>
            {gs.trump || "?"}
          </div>
        </div>

        {/* Trump choice (only for the trump selector) */}
        {chooseTrump && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded bg-white/90 p-2">
            <p className="mb-1 text-center text-sm font-semibold">
              Choose trump (look at your 5 cards)
            </p>
            <div className="flex gap-2">
              {SUITS.map((suit) => (
                <button
                  key={suit}
                  onClick={() => play(suit)}
                  className={
                    "flex-1 rounded border bg-white p-2 text-2xl " + (isRed(suit) ? "text-red-600" : "")
                  }
                >
                  {suit}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Blind pick: tap one of the giver's face-down cards */}
        {pickCard && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded bg-white/90 p-2">
            <p className="mb-1 text-center text-sm font-semibold">
              Pick one card blindly from {names[gs.exchange.giver]}
            </p>
            <div className="flex justify-center gap-0.5">
              {gs.my_moves.map((index) => (
                <button
                  key={index}
                  onClick={() => play(index)}
                  className="min-w-0 flex-1"
                  style={{ maxWidth: 28 }}
                >
                  <Card back fill />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result pop-up when the round or match ends */}
        {gs.round_over && (
          <ResultOverlay
            title={title}
            subtitle={gs.match_over ? "Highest total wins" : "Green = met or beat the target"}
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