import Hand from "../../components/Hand";
import ResultOverlay from "../../components/ResultOverlay";
import TableSeats, { PlayerTag } from "../../components/TableSeats";
import TrickArea from "../../components/TrickArea";

// const SUITS = ["♠", "♥", "♣", "♦"];

const isRed = (text) => text.includes("♥") || text.includes("♦");

// Team A = seats 0 and 2, Team B = seats 1 and 3
const teamOf = (seat) => (seat % 2 === 0 ? "Team A" : "Team B");

export default function CourtTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;
  const myTurn = gs.my_moves.length > 0;
  const play = (move) => send({ action: "play", card: move });

  // Name of the target holder (who chooses trump), with a safe fallback
  const holderName =
    gs.target_holder === null || gs.target_holder === undefined
      ? "Target holder"
      : names[gs.target_holder];

  // Small text in each name label: team and tricks won by that team
  const info = names.map((_, s) => `${teamOf(s)} · ${gs.tricks_won[s % 2]} tricks`);

  // Text under each name: Sarkari (starts play), target, passed, top bid
  const status = names.map((_, s) => {
    const tags = [];
    if (s === gs.sarkari) tags.push("Sarkari · starts");
    if (gs.phase === "bid" && !gs.active[s]) tags.push("Passed");
    if (gs.phase === "bid" && gs.highest === s) tags.push(`Bid ${gs.bid_value}`);
    if (s === gs.target_holder) tags.push(`Target ${gs.target}`);
    return tags.join(" · ");
  });

  // The hint line above my cards
  let hint = "Your cards";
  if (gs.phase === "score") {
    hint = myTurn ? "Choose the winning score" : "Team A is choosing the winning score";
  } else if (gs.phase === "bid") {
    hint = myTurn
      ? gs.highest === null
        ? "Bid 6 to 9, or pass"
        : `Bid higher than ${gs.bid_value}, or pass`
      : "Bidding...";
  } else if (gs.phase === "trump") {
    hint = myTurn ? "You chose the target: choose the trump suit" : `${holderName} is choosing trump`;
  } else if (gs.phase === "play" && myTurn) {
    hint = "Your turn: tap a green card";
  }

  // Button text for score and bid choices
  const choiceLabel = (m) =>
    gs.phase === "score" ? `${m} points` : m === "pass" ? "Pass" : `Bid ${m}`;

  // Result pop-up: one row per team
  const rows = [0, 1].map((t) => ({
    name: t === 0 ? "Team A (Player 1 + 3)" : "Team B (Player 2 + 4)",
    you: me % 2 === t,
    detail: `${gs.round_points[t] > 0 ? "+" : ""}${gs.round_points[t]}`,
    total: gs.points[t],
    good: gs.round_points[t] > 0,
  }));

  return (
    <div>
      {/* Team totals */}
      <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded bg-blue-900 p-2 text-center text-white">Team A · {gs.points[0]} pts</div>
        <div className="rounded bg-green-900 p-2 text-center text-white">Team B · {gs.points[1]} pts</div>
      </div>

      {/* Round, winning score and trump */}
      <p className="mb-2 flex justify-between text-xs font-semibold">
        <span>Round {gs.round} · Winning score {gs.winning_score ?? "—"}</span>
        <span>
          Trump{" "}
          {gs.trump ? <b className={isRed(gs.trump) ? "text-red-600" : ""}>{gs.trump}</b> : "?"}
        </span>
      </p>
      <p className="mb-2 rounded bg-yellow-100 p-2 text-sm">{gs.message}</p>

      <TableSeats
        names={names}
        mySeat={me}
        hands={gs.hand_sizes}
        turn={gs.round_over ? null : gs.turn}
        info={info}
        status={status}
        height="h-[min(30rem,64vh)]"
        bottom={
          <div className="text-center">
            <PlayerTag name={names[me] + " (you)"} active={gs.turn === me && !gs.round_over} info={info[me]} />
            <p className="mt-1 text-xs text-white/80">{hint}</p>

            {/* Score choice and bid buttons */}
            {(gs.phase === "score" || gs.phase === "bid") && myTurn && (
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {gs.my_moves.map((m) => (
                  <button
                    key={m}
                    onClick={() => play(m)}
                    className="rounded bg-green-600 px-3 py-1 text-sm font-semibold text-white"
                  >
                    {choiceLabel(m)}
                  </button>
                ))}
              </div>
            )}

            {/* Trump choice (only the target holder) */}
            {gs.phase === "trump" && myTurn && (
              <div className="mt-2 flex justify-center gap-2">
                {gs.my_moves.map((suit) => (
                  <button
                    key={suit}
                    onClick={() => play(suit)}
                    className={"rounded bg-white px-4 py-1 text-2xl " + (isRed(suit) ? "text-red-600" : "")}
                  >
                    {suit}
                  </button>
                ))}
              </div>
            )}

            <Hand
              cards={gs.my_hand}
              aceHigh
              playable={gs.phase === "play" ? gs.my_moves : []}
              onPlay={(code) => play(code)}
            />
          </div>
        }
      >
        {/* Cards on the table, with the winner sweep */}
        <TrickArea
          trick={gs.trick}
          lastTrick={gs.last_trick}
          lastWinner={gs.last_winner}
          tricksDone={gs.tricks_done}
          mySeat={me}
          total={names.length}
        />

        {gs.round_over && (
          <ResultOverlay
            title={
              gs.match_over
                ? `${gs.winner_team === 0 ? "Team A" : "Team B"} wins the game!`
                : `Round ${gs.round} finished`
            }
            subtitle={`${holderName} · target ${gs.target}`}
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