import { useEffect, useState } from "react";
import ResultOverlay from "../../components/ResultOverlay";
import ThrowTray from "./ThrowTray";

// How long one house takes while a token slides (milliseconds)
const STEP_TIME = 180;

// Turn a house a quarter turn clockwise (same rule as rotate() in board.py).
function rotate(cell, turns) {
  let [r, c] = cell;
  for (let i = 0; i < turns % 4; i++) {
    [r, c] = [c, 4 - r];
  }
  return [r, c];
}

// Move tokens ONE house at a time, in two stages:
// 1) forward moves slide first (the token that made the move),
// 2) only after all forward moves are finished, cut tokens slide BACK to their home.
// So a cut token stays on its house until your token has arrived there.
function stepToward(shown, target) {
  // Is any token still sliding forward?
  const forwardPending = shown.some((tokens, seat) =>
    tokens.some((step, t) => target[seat][t] > step)
  );

  let changed = false;
  const next = shown.map((tokens, seat) =>
    tokens.map((step, t) => {
      const goal = target[seat][t];
      if (step === goal) return step;          // already in the right place

      if (goal > step) {
        changed = true;
        return step + 1;                       // forward: always move
      }

      // Backward (a cut token): wait until no forward move is still sliding
      if (forwardPending) return step;
      changed = true;
      return step - 1;                         // slide back one house toward home
    })
  );
  return changed ? next : shown;
}

// One token: a coloured circle with a white star icon (no number).
// "big" = normal size, "small" = shrunk in a crowded house.
// A clickable token glows and can be touched to move.
function Chip({ color, big, clickable, onClick }) {
  const size = big ? "h-6 w-6 border-2" : "h-3.5 w-3.5 border";
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={
        "m-px inline-flex shrink-0 items-center justify-center rounded-full border-white p-0 shadow " +
        size + " " +
        (clickable ? "cursor-pointer ring-4 ring-yellow-300 animate-pulse" : "cursor-default")
      }
      style={{ background: color }}
    >
      <svg viewBox="0 0 24 24" className={big ? "h-3.5 w-3.5" : "h-1.5 w-1.5"} fill="white">
        <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.8 5.8 21.2l1.6-7L2 9.5l7.1-.6z" />
      </svg>
    </button>
  );
}

export default function AstaTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;

  // Turn the board so MY home is at the bottom of my screen.
  // Seat 2 (Orange) is the bottom player on the server, so we turn by the difference.
  const turns = (2 - me + 4) % 4;
  const toScreen = (cell) => rotate(cell, turns);

  // What am I asked to do now?
  const throwNow = gs.my_moves.includes("throw");        // my turn to throw
  const moveNow = !throwNow && gs.my_moves.length > 0;   // I must choose a token
  const play = (card) => send({ action: "play", card });

  // What the board SHOWS. It starts equal to the server, then catches up
  // one house at a time, so tokens look like they slide along the path.
  const [shown, setShown] = useState(gs.steps);
  useEffect(() => {
    const id = setTimeout(() => setShown((prev) => stepToward(prev, gs.steps)), STEP_TIME);
    return () => clearTimeout(id);
  }, [shown, gs.steps]);

  // Where the name label goes: the side of the board where this player's home is.
  // Homes are always in the middle of a side, so one of these four is right.
  const labelFor = (seat) => {
    const [r, c] = toScreen(gs.homes[seat]);
    const side = r === 0 ? "top" : r === 4 ? "bottom" : c === 0 ? "left" : "right";
    const place = {
      top: "absolute left-1/2 top-0 -translate-x-1/2",
      bottom: "absolute bottom-0 left-1/2 -translate-x-1/2",
      left: "absolute left-0 top-1/2 -translate-y-1/2",
      right: "absolute right-0 top-1/2 -translate-y-1/2",
    }[side];
    return place;
  };

  // The screen cell for a token at a given step.
  // Step 0 = the home house; steps 1 to 24 = the path houses (24 = centre).
  const cellFor = (seat, step) =>
    toScreen(step === 0 ? gs.homes[seat] : gs.tracks[seat][step - 1]);

  // Empty 5 x 5 grid. Each house remembers its owner (if it is a home) and its tokens.
  const grid = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => ({ owner: null, tokens: [] }))
  );

  // Mark the four homes (cross houses)
  gs.homes.forEach((home, seat) => {
    const [r, c] = toScreen(home);
    grid[r][c].owner = seat;
  });

  // Place every token where it is SHOWN right now
  shown.forEach((tokens, seat) =>
    tokens.forEach((step, t) => {
      const [r, c] = cellFor(seat, step);
      grid[r][c].tokens.push({ seat, t });
    })
  );

  // The 25 squares. The grid size never changes; crowded houses shrink their tokens.
  const cells = grid.flatMap((row, r) =>
    row.map((cell, c) => {
      const centre = r === 2 && c === 2;
      const crowded = cell.tokens.length > 1;
      return (
        <div
          key={`${r}-${c}`}
          className={
            "relative flex aspect-square flex-wrap content-center items-center justify-center overflow-hidden border border-amber-900 " +
            (centre ? "rounded-full bg-amber-100" : "rounded bg-orange-50")
          }
          // A home gets a light tint of its owner's colour (40 = about 25% strength)
          style={cell.owner !== null ? { background: gs.colors[cell.owner] + "40" } : undefined}
        >
          {/* Cross mark on a home = safe house */}
          {cell.owner !== null && (
            <span className="absolute text-2xl font-black opacity-20">✕</span>
          )}
          {centre && cell.tokens.length === 0 && (
            <span className="text-[10px] font-bold">FINISH</span>
          )}
          {cell.tokens.map(({ seat, t }) => {
            // A token glows only if it is mine and I may move it now
            const clickable = moveNow && seat === me && gs.my_moves.includes(String(t));
            // Normal size if: the house is not crowded, it can be moved, or it belongs to
            // the player whose turn it is. Other tokens in a crowded house shrink.
            const big = !crowded || clickable || seat === gs.turn;
            return (
              <Chip
                key={`${seat}-${t}`}
                color={gs.colors[seat]}
                big={big}
                clickable={clickable}
                onClick={() => play(String(t))}
              />
            );
          })}
        </div>
      );
    })
  );

  // Result pop-up rows: rank for single mode, team name for team mode
  const rows = names.map((n, s) => ({
    name: n,
    you: s === me,
    detail:
      gs.mode === "team"
        ? (s % 2 === 0 ? "Team A" : "Team B")
        : gs.ranking.includes(s)
        ? `#${gs.ranking.indexOf(s) + 1}`
        : "not finished",
    total: `${gs.done[s]}/4 home`,
    good: gs.winners.includes(s),
  }));
  const title =
    gs.mode === "team"
      ? `Team ${gs.winners.includes(0) ? "A" : "B"} wins!`
      : `${names[gs.winners[0]]} wins!`;

  return (
    <div className="mx-auto max-w-md">
      {/* Header: one coloured box per player, showing only tokens home
      <div className="mb-2 grid grid-cols-2 gap-1 text-xs">
        {names.map((_, s) => (
          <div
            key={s}
            className={
              "rounded px-2 py-1 text-center text-white " +
              (gs.turn === s && !gs.match_over ? "ring-2 ring-yellow-300" : "")
            }
            style={{ background: gs.colors[s], textShadow: "0 0 2px #000" }}
          >
            {gs.done[s]}/4 home
            {gs.skip[s] && " · skips next turn"}
          </div>
        ))}
      </div> */}

      {/* The board, with each player's name beside their home house */}
      <div className="relative px-12 py-6">
        <div className="grid grid-cols-5 gap-1 rounded-xl bg-orange-200 p-2">{cells}</div>

        {names.map((n, s) => (
          <span
            key={s}
            className={
              labelFor(s) +
              " z-10 whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-bold text-black"
            }
            // Same light colour as this player's home house
            style={{ background: gs.colors[s] + "40" }}
          >
            {n}
          </span>
        ))}

        {gs.match_over && (
          <ResultOverlay
            title={title}
            subtitle={
              gs.mode === "team"
                ? "First team with all 8 tokens home"
                : "Everyone plays until all 4 tokens are home"
            }
            rows={rows}
            matchOver={true}
            isHost={false}
            onNext={() => {}}
          />
        )}
      </div>

      {/* Throw tray: the shells shuffle, then show open and closed sides */}
      <ThrowTray
        canThrow={throwNow}
        onThrow={() => play("throw")}
        openSides={gs.open_sides ?? 0}
        throwValue={gs.throw_value}
        extra={gs.throw_extra}
        throwId={gs.throw_id}
        label={throwNow ? "Your turn: throw the cowries" : `${names[gs.turn]} is up`}
      />

      {moveNow && (
        <p className="mt-2 text-center text-sm font-semibold">
          Touch a glowing token on the board to move it {gs.throw_value} houses
        </p>
      )}

      <p className="mt-3 rounded bg-yellow-100 p-2 text-center text-sm">{gs.message}</p>
    </div>
  );
}