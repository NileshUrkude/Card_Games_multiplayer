import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/Card";
import { placesFrom, placeText } from "../../components/places";

const CAPS = [3, 3, 3, 4];                                    // cards each group takes
const LABELS = ["Strongest", "Second", "Third", "Weakest"];   // name above each group
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]; // low → high
const SUITS = ["♠", "♥", "♦", "♣"];                           // suit order for sorting
const TARGET = 1000;
const DRAG_PX = 8;                                            // movement before a press becomes a drag

const rankOf = (c) => c.slice(0, -1);
const suitOf = (c) => c.slice(-1);

// Sort cards: by rank (highest first), or by suit and then rank
function sortCards(list, by) {
  return [...list].sort((a, b) => {
    const rank = RANKS.indexOf(rankOf(b)) - RANKS.indexOf(rankOf(a));
    const suit = SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b));
    return by === "suit" ? suit || rank : rank || suit;
  });
}

export default function ChourailTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;
  const phase = gs.phase;
  const arranging = phase === "arrange";
  const canEdit = arranging && !gs.confirmed[me];
  const check = gs.check;

  const [selected, setSelected] = useState([]);   // cards tapped so far (several allowed)
  const [sort, setSort] = useState("rank");       // how the dealt cards are sorted
  const [drag, setDrag] = useState(null);         // card being dragged, and its position
  const [over, setOver] = useState(null);         // zone under the finger
  const [note, setNote] = useState("");           // short message for a bad move

  // The newest arrangement and send function, read by the pointer handlers
  const latest = useRef({});
  useEffect(() => {
    latest.current = { arr: gs.my_arr, send };
  });

  const act = (obj) => send({ action: "play", card: JSON.stringify(obj) });
  const last = gs.round_history[gs.round_history.length - 1];
  const winnerNow = (phase === "round_result" || phase === "deal_result") && last ? last.winner : null;
  const topTotal = Math.max(...gs.totals);
  const leaderSeat = gs.totals.indexOf(topTotal);
  const lastPlay = gs.plays[gs.plays.length - 1];

  // Which drop zone is under this point of the screen?
  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const zone = el && el.closest ? el.closest("[data-drop]") : null;
    return zone ? zone.getAttribute("data-drop") : null;
  }

  // Put cards into a zone ("pool" or "g-0" to "g-3") and send the new arrangement.
  // Returns true if the move was sent.
  function placeCards(cards, zone) {
    const next = latest.current.arr.map((g) => g.filter((c) => !cards.includes(c)));
    if (zone !== "pool") {
      const i = Number(zone.slice(2));
      if (next[i].length + cards.length > CAPS[i]) {
        setNote(`Group ${i + 1} has room for only ${CAPS[i] - next[i].length} more card(s)`);
        return false;
      }
      next[i] = [...next[i], ...cards];
    }
    setNote("");
    latest.current.send({ action: "play", card: JSON.stringify({ do: "set", groups: next }) });
    return true;
  }

  // Tap a zone while cards are selected: the selected cards move there
  function tapZone(zone) {
    if (!canEdit || selected.length === 0) return;
    if (placeCards(selected, zone)) setSelected([]);
  }

  // The Group button: put the selected cards into the first empty group that fits.
  // 3 cards go to Group 1, 2 or 3. 4 cards go to Group 4.
  function makeGroup() {
    const n = selected.length;
    const options = n === 4 ? [3] : n === 3 ? [0, 1, 2] : [];
    const slot = options.find((i) => latest.current.arr[i].length === 0);
    if (slot === undefined) {
      setNote(n < 3 ? "Select 3 cards (or 4 for Group 4), then press Group" : "No empty group fits these cards");
      return;
    }
    if (placeCards(selected, `g-${slot}`)) setSelected([]);
  }

  // Press a card: a tap selects or unselects it, a move of more than a few pixels drags it
  function onDown(e, card) {
    if (!canEdit) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const onMove = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_PX) moved = true;
      if (moved) {
        setDrag({ card, x: ev.clientX, y: ev.clientY });
        setOver(zoneAt(ev.clientX, ev.clientY));
      }
    };
    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) {
        const zone = zoneAt(ev.clientX, ev.clientY);
        if (zone) placeCards([card], zone);
        setDrag(null);
        setOver(null);
      } else {
        setSelected((s) => (s.includes(card) ? s.filter((c) => c !== card) : [...s, card]));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Confirm locks the arrangement straight away (no pop-up)
  function confirm() {
    act({ do: "confirm" });
  }

  // One dealt card in the bottom row. Each card covers half of the card before it.
  const dealtCard = (c, i) => (
    <div
      key={c}
      data-card
      onPointerDown={(e) => onDown(e, c)}
      className={"shrink-0 touch-none select-none " + (drag && drag.card === c ? "opacity-40" : "")}
      style={{ marginLeft: i === 0 ? 0 : -20 }}
    >
      <Card code={c} size="sm" playable={selected.includes(c)} />
    </div>
  );

  // One group slot: label on top, its cards in one row, and the combination name once valid
  const slot = (i) => {
    const g = gs.my_arr[i] || [];
    const zone = `g-${i}`;
    return (
      <div
        key={i}
        data-drop={zone}
        onClick={(e) => {
          if (!e.target.closest("[data-card]")) tapZone(zone);
        }}
        className={"min-w-0 rounded-md p-0.5 " + (over === zone ? "bg-yellow-300/40" : "")}
      >
        <div className="mb-1 text-center text-[10px] font-semibold leading-tight text-white">
          <div>
            G{i + 1} · {g.length}/{CAPS[i]}
          </div>
          <div className="text-white/70">{LABELS[i]}</div>
        </div>
        <div className="flex h-28 items-center justify-center overflow-hidden">
          {g.length === 0 ? (
            <span className="text-center text-[10px] text-white/70">Empty</span>
          ) : (
            g.map((c, k) => (
              <div
                key={c}
                data-card
                onPointerDown={(e) => onDown(e, c)}
                className={"shrink-0 touch-none select-none " + (drag && drag.card === c ? "opacity-40" : "")}
                style={{ marginLeft: k === 0 ? 0 : -12 }}
              >
                <Card code={c} size="xs" style={{ width: 28, height: 44 }} playable={selected.includes(c)} />
              </div>
            ))
          )}
        </div>
        {check.names[i] && (
          <p className="mt-0.5 text-center text-[9px] text-yellow-200">{check.names[i]}</p>
        )}
      </div>
    );
  };

  // One line above the points table, showing the result of the last round or deal
  let resultLine = null;
  if (phase === "round_result" && last) {
    resultLine = `Round ${last.round}: ${names[last.winner]} wins with ${last.name} · +${last.points} points. Next round starts automatically.`;
  } else if (phase === "deal_result") {
    resultLine = `Deal ${gs.deal_no} finished. The next deal starts automatically.`;
  } else if (phase === "final") {
    resultLine = `Game over! ${gs.winners.map((i) => names[i]).join(" & ")} wins with ${gs.totals[gs.winners[0]]} points.`;
  }

  const places = topTotal > 0 ? placesFrom(gs.totals) : null;   // null = no points yet
  const PLACE_TEXT = ["", "text-yellow-600 font-extrabold", "text-gray-600 font-bold", "text-orange-700 font-bold"];
  // ------------------------------------
  return (
    <div className="relative mx-auto w-full max-w-md rounded-3xl bg-green-800 p-3 text-white shadow-inner">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        <span className="font-bold">Chourail · Deal {gs.deal_no}</span>
        <span className="rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-black">
          Round {gs.round} of 4
        </span>
      </div>

      <p className="mb-2 text-center text-xs text-white/80">
        Target {TARGET} · Leader {names[leaderSeat]} with {topTotal}
      </p>

      {/* Players: the active player is outlined, the round winner is starred */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
        {names.map((nm, s) => {
          const play = gs.plays.find((p) => p.seat === s);
          const won = winnerNow === s;
          const active = arranging
            ? !gs.confirmed[s]
            : phase === "reveal" && lastPlay && lastPlay.seat === s;
          const status = arranging
            ? gs.confirmed[s]
              ? "✓ Confirmed"
              : `Arranging ${gs.arranged[s]}/13`
            : play
            ? play.name
            : "Waiting";
          return (
            <div
              key={s}
              className={
                "rounded p-2 " +
                (won
                  ? "bg-yellow-200 text-black ring-2 ring-yellow-300"
                  : active
                  ? "bg-green-700 text-white ring-2 ring-yellow-300"
                  : "bg-green-900 text-white")
              }
            >
              <div className="font-bold">
                {nm}
                {s === me && " (you)"}
                {won && " ★"}
              </div>
              <div className="text-[10px] opacity-80">{status}</div>
              {play && (
                <div className="mt-1 flex justify-center">
                  {play.cards.map((c, k) => (
                    <div key={c} style={{ marginLeft: k === 0 ? 0 : -10 }}>
                      <Card code={c} size="xs" style={{ width: 28, height: 44 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Arranging: groups on top, dealt cards below */}
      {arranging && (
        <>
          <div className="mb-2 grid grid-cols-4 gap-1">{[0, 1, 2, 3].map(slot)}</div>

          <div
            data-drop="pool"
            onClick={(e) => {
              if (!e.target.closest("[data-card]")) tapZone("pool");
            }}
            className={"mb-2 rounded-xl bg-green-900/40 p-2 " + (over === "pool" ? "ring-4 ring-yellow-300" : "")}
          >
            <p className="mb-1 text-xs font-semibold text-white">
              Dealt cards · {gs.my_pool.length}
              {selected.length > 0 && <span className="ml-2 text-yellow-300">Selected: {selected.length}</span>}
            </p>
            <div className="flex min-h-26 flex-nowrap items-center overflow-x-auto pb-1 pt-2">
              {sortCards(gs.my_pool, sort).map((c, i) => dealtCard(c, i))}
            </div>
          </div>

          {note && <p className="mb-2 rounded bg-red-600/80 p-2 text-center text-xs">{note}</p>}

          {check.ok && (
            <p className="mb-2 rounded bg-green-600/70 p-2 text-center text-xs">
              All four groups are valid. You can confirm.
            </p>
          )}

          {/* Buttons in one row */}
          <div className="mb-2 flex gap-1 text-[11px]">
            <button
              disabled={!canEdit || selected.length < 3}
              onClick={makeGroup}
              className="flex-1 whitespace-nowrap rounded bg-green-700 p-2 font-semibold text-white disabled:opacity-40"
            >
              Group
            </button>
            <button
              disabled={!canEdit}
              onClick={() => {
                setSelected([]);
                act({ do: "auto" });
              }}
              className="flex-1 whitespace-nowrap rounded bg-green-700 p-2 font-semibold text-white disabled:opacity-40"
            >
              Auto
            </button>
            <button
              disabled={!canEdit}
              onClick={() => {
                setSelected([]);
                act({ do: "clear" });
              }}
              className="flex-1 whitespace-nowrap rounded bg-gray-600 p-2 font-semibold text-white disabled:opacity-40"
            >
              Clear
            </button>
            <button
              onClick={() => setSort(sort === "rank" ? "suit" : "rank")}
              className="flex-1 whitespace-nowrap rounded bg-blue-700 p-2 font-semibold text-white"
            >
              Sort: {sort === "rank" ? "Rank" : "Suit"}
            </button>
            <button
              disabled={!canEdit || !check.ok}
              onClick={confirm}
              className="flex-1 whitespace-nowrap rounded bg-yellow-400 p-2 font-bold text-black disabled:opacity-40"
            >
              Confirm
            </button>
          </div>

          {gs.confirmed[me] && (
            <p className="mb-2 text-center text-xs">You confirmed. Waiting for the other players...</p>
          )}
        </>
      )}

      {/* During play: my locked groups, with the group being shown now outlined */}
      {!arranging && gs.my_arr.length > 0 && (
        <div className="mb-2 grid grid-cols-4 gap-1 text-center">
          {gs.my_arr.map((g, i) => (
            <div
              key={i}
              className={
                "rounded p-1 " +
                (phase === "reveal" && i === gs.round - 1 ? "bg-yellow-200/30 ring-2 ring-yellow-300" : "")
              }
            >
              <div className="text-[10px]">
                G{i + 1}
                {phase === "reveal" && i === gs.round - 1 ? " · now" : ""}
              </div>
              <div className="flex justify-center">
                {g.map((c, k) => (
                  <div key={c} style={{ marginLeft: k === 0 ? 0 : -12 }}>
                    <Card code={c} size="xs" style={{ width: 28, height: 44 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Result line, shown with the points table (no pop-up) */}
      {resultLine && (
        <p className="mb-2 rounded bg-yellow-200 p-2 text-center text-xs font-semibold text-black">
          {resultLine}
        </p>
      )}

      {/* Points table: black text on white. The Place column shows 1st, 2nd, 3rd... */}
      <div className="mb-2 overflow-x-auto rounded-xl bg-white p-2 text-black">
        <table className="w-full text-center text-[11px]">
          <thead>
            <tr className="text-black/60">
              <th className="text-left">Player</th>
              <th>R1</th>
              <th>R2</th>
              <th>R3</th>
              <th>R4</th>
              <th>Deal</th>
              <th>Total</th>
              <th>Place</th>
            </tr>
          </thead>
          <tbody>
            {names.map((nm, s) => {
              const place = places ? places[s] : null;
              const style = place && place <= 3 ? PLACE_TEXT[place] : "";
              const isRoundWinner = winnerNow === s;
              return (
                <tr key={s} className={isRoundWinner ? "bg-yellow-100" : ""}>
                  <td className={"text-left " + style}>{nm}</td>
                  {gs.round_pts.map((r, k) => (
                    <td key={k} className={style}>
                      {r[s]}
                    </td>
                  ))}
                  <td className={style}>{gs.deal_pts[s]}</td>
                  <td className={style}>{gs.totals[s]}</td>
                  <td className={"font-bold " + style}>{place ? placeText(place) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="rounded bg-yellow-100 p-2 text-center text-sm text-black">{gs.message}</p>

      <div className="mt-2 flex justify-center gap-4 text-xs">
        <Link to="/" className="text-white/70 underline">
          Main menu
        </Link>
        {gs.match_over && (
          <Link to="/game/chourail" className="text-white/70 underline">
            New game
          </Link>
        )}
      </div>

      {/* The card being dragged follows the finger */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }}
        >
          <Card code={drag.card} size="sm" />
        </div>
      )}
    </div>
  );
}