import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/Card";
import ResultOverlay from "../../components/ResultOverlay";

const rankOf = (code) => code.slice(0, -1);
const suitOf = (code) => code.slice(-1);
const HOLD_MS = 280;   // how long a card must be pressed before it can be dragged

// Ranks from lowest to highest, with the Ace on top (used for descending order)
const HIGH_ORDER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const SUITS = ["♠", "♥", "♦", "♣"];

// Sort cards from highest to lowest: A, K, Q, J, 10 ... 2.
// Cards of the same rank are ordered by suit.
function sortDesc(list) {
  return [...list].sort(
    (a, b) =>
      HIGH_ORDER.indexOf(rankOf(b)) - HIGH_ORDER.indexOf(rankOf(a)) ||
      SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b))
  );
}

// Put a dragged card into the zone it was dropped on.
// Returns the new groups, or null if the drop is not allowed.
function moveCard(groups, card, zone) {
  // 1. take the card out of its current group (it may already be loose)
  const base = groups.map((g) => g.filter((c) => c !== card));

  // 2. put it where it was dropped
  if (zone === "ungrouped") return base.filter((g) => g.length > 0);

  if (zone === "new") {
    if (base.filter((g) => g.length > 0).length >= 4) return null;   // at most 4 groups
    return [...base, [card]].filter((g) => g.length > 0);
  }

  if (zone.startsWith("g-")) {
    const i = Number(zone.slice(2));
    if (base[i].length >= 4) return null;                            // a group holds 4 cards
    base[i] = [...base[i], card];
    return base.filter((g) => g.length > 0);
  }
  return null;
}

export default function RummyTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;
  const other = 1 - me;

  const myTurn = gs.turn === me && !gs.round_over && !gs.hold;
  const inDiscard = myTurn && gs.phase === "discard";
  const canDraw = myTurn && gs.phase === "draw";
  const groups = gs.my_groups;

  const [selected, setSelected] = useState([]);   // cards tapped (not dragged)
  const [drag, setDrag] = useState(null);         // card being dragged, and where it is
  const [over, setOver] = useState(null);         // the drop zone under the finger

  // The latest values for the drop handler
  const latest = useRef({});
  useEffect(() => {
    latest.current = { groups, ungrouped: gs.my_ungrouped, inDiscard, send };
  });
  const press = useRef({ timer: null, dragging: false });

  const sel = selected.filter((c) => gs.my_hand.includes(c));
  const selUngrouped = sel.filter((c) => gs.my_ungrouped.includes(c));
  const selGrouped = sel.filter((c) => !gs.my_ungrouped.includes(c));

  // Send one action to the server (the server checks it)
  const act = (obj) => send({ action: "play", card: JSON.stringify(obj) });

  const toggle = (code) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  // Which drop zone is under this point of the screen?
  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const zone = el && el.closest ? el.closest("[data-drop]") : null;
    return zone ? zone.getAttribute("data-drop") : null;
  }

  // Called when a dragged card is let go
  function drop(card, x, y) {
    const zone = zoneAt(x, y);
    const cur = latest.current;
    if (!zone) return;                       // dropped on nothing: it stays where it was

    if (zone === "discard") {
      if (cur.inDiscard && cur.ungrouped.includes(card)) {
        cur.send({ action: "play", card: JSON.stringify({ do: "discard", card }) });
      }
      return;
    }

    const next = moveCard(cur.groups, card, zone);
    if (next) cur.send({ action: "play", card: JSON.stringify({ do: "arrange", groups: next }) });
  }

  // Press on a card: a quick tap selects it, holding it lets you drag it
  function onCardDown(e, code) {
    if (gs.round_over) return;
    const p = press.current;
    p.dragging = false;
    clearTimeout(p.timer);
    let x = e.clientX;
    let y = e.clientY;

    p.timer = setTimeout(() => {
      p.dragging = true;
      setDrag({ card: code, x, y });
    }, HOLD_MS);

    const move = (ev) => {
      x = ev.clientX;
      y = ev.clientY;
      if (!p.dragging) return;
      setDrag({ card: code, x, y });
      setOver(zoneAt(x, y));
    };

    const up = (ev) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      clearTimeout(p.timer);
      if (p.dragging) {
        p.dragging = false;
        setDrag(null);
        setOver(null);
        drop(code, ev.clientX, ev.clientY);
      } else {
        toggle(code);                        // a quick tap
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // One card in a row. Each card after the first covers half of the card before it.
  // The card you just drew gets a blue outline until you discard it.
  const cardBox = (c, i) => {
    const justDrawn = c === gs.drawn_card;
    return (
      <div
        key={c}
        onPointerDown={(e) => onCardDown(e, c)}
        className={
          "shrink-0 touch-none select-none rounded-md " +
          (justDrawn ? "ring-2 ring-blue-500 " : "") +
          (drag && drag.card === c ? "opacity-40" : "")
        }
        style={{ marginLeft: i === 0 ? 0 : -20 }}
      >
        <Card code={c} size="sm" playable={sel.includes(c)} highlight={rankOf(c) === gs.joker_rank} />
      </div>
    );
  };
  
  // Buttons
  const makeGroup = () => act({ do: "arrange", groups: [...groups, selUngrouped] });
  const removeSelected = () =>
    act({
      do: "arrange",
      groups: groups.map((g) => g.filter((c) => !selGrouped.includes(c))).filter((g) => g.length > 0),
    });
  const discard = () => {
    act({ do: "discard", card: selUngrouped[0] });
    setSelected([]);
  };
  const draw = (pile) => {
    act({ do: "draw", pile });
    setSelected([]);
  };

  // My loose cards, shown from highest to lowest
  const looseSorted = sortDesc(gs.my_ungrouped);

  // Short hint for what to do next
  let hint = "";
  if (gs.round_over) hint = "Round over";
  else if (!myTurn && gs.turn === other) hint = `${names[other]} is playing...`;
  else if (gs.phase === "draw") hint = "Tap the face-down pile or the discard pile";
  else if (gs.phase === "discard")
    hint = "Hold a card and drag it into groups. Then discard one loose card. If your other 13 cards are valid groups, the discard wins the round.";

  return (
    <div className="relative mx-auto w-full max-w-md rounded-3xl bg-green-800 p-3 text-white shadow-inner">      {/* Header: round, joker and scores */}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold">Rummy · Round {gs.round}</span>
        <span className="rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-black">
          Joker: {gs.joker_rank}
        </span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2 text-center text-xs">
        <div className={"rounded p-2 text-white " + (myTurn ? "bg-green-600 ring-2 ring-yellow-300" : "bg-green-900")}>
          {names[me]} (you) · {gs.scores[me]} pts
        </div>
        <div
          className={
            "rounded p-2 text-white " +
            (gs.turn === other && !gs.round_over ? "bg-green-700 ring-2 ring-yellow-300" : "bg-green-900")
          }
        >
          {names[other]} · {gs.scores[other]} pts
        </div>
      </div>

      {/* Opponent: hidden cards (only the count is real) */}
      <div className="mb-3 text-center">
        <p className="mb-1 text-xs font-semibold">
          {names[other]} · {gs.opp_count} cards
          {gs.turn === other && !gs.round_over && (
            <span className="ml-2 animate-pulse text-yellow-300">thinking...</span>
          )}
        </p>
        <div className="flex justify-center">
          {Array.from({ length: gs.opp_count }, (_, i) => (
            <Card key={i} back size="xs" style={{ marginLeft: i === 0 ? 0 : -18 }} />
          ))}
        </div>
      </div>

      {/* 1-minute discard timer (shown to the player who must discard) */}
      {gs.timer_left !== null && gs.timer_left !== undefined && !gs.round_over && (
        <p
          className={
            "mb-2 rounded p-2 text-center text-sm font-bold " +
            (gs.timer_left <= 10 ? "bg-red-600 text-white" : "bg-yellow-200 text-black")
          }
        >
          {myTurn
            ? `Discard within ${gs.timer_left}s, or the drawn card is discarded for you`
            : `${names[gs.turn]} has ${gs.timer_left}s to discard`}
        </p>
      )}

      {/* The piles: face-down (with the Joker card beside it) and the discard */}
      <div className="mb-3 flex items-center justify-center gap-6">
        <div className="flex flex-col items-center">
          <div className="flex items-end gap-2">
            <button
              type="button"
              disabled={!canDraw || gs.draw_count === 0}
              onClick={() => draw("deck")}
              className="disabled:opacity-40"
            >
              <Card back size="md" />
            </button>
            {gs.indicator && <Card code={gs.indicator} size="sm" highlight />}
          </div>
          <span className="mt-1 text-xs">Face-down · {gs.draw_count}</span>
        </div>

        <button
          type="button"
          data-drop="discard"
          disabled={!canDraw || !gs.discard_top}
          onClick={() => draw("discard")}
          className={
            "flex flex-col items-center disabled:opacity-40 " +
            (over === "discard" ? "rounded ring-4 ring-yellow-300" : "")
          }
        >
          {gs.discard_top ? (
            <Card code={gs.discard_top} size="md" highlight={rankOf(gs.discard_top) === gs.joker_rank} />
          ) : (
            <div className="h-16 w-11 rounded border border-dashed" />
          )}
          <span className="mt-1 text-xs">Discard · {gs.discard_count}</span>
        </button>
      </div>

      {/* Groups 1 to 4 in ONE row. Each slot is fixed in width, so nothing scrolls.
          The label is stacked: name on top, tick or cross centred below it. */}
      <div className="mb-2 grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((i) => {
          const g = groups[i];                       // the group in this slot, or undefined
          const status = (g && gs.my_group_status[i]) || { ok: false, reason: "" };
          const empty = !g;
          const zone = empty ? "new" : `g-${i}`;

          return (
            <div
              key={i}
              data-drop={zone}
              className={"min-w-0 rounded-md p-0.5 " + (over === zone ? "bg-yellow-300/40" : "")}
            >
              {/* Label: group name on top, then the count and tick/cross centred below */}
              <div className="mb-1 text-center text-[10px] font-semibold leading-tight text-white">
                <div className="truncate">G{i + 1}</div>
                {!empty && (
                  <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                    <span>{g.length}</span>
                    <span className={status.ok ? "text-green-300" : "text-red-300"}>
                      {status.ok ? "✓" : "✕"}
                    </span>
                  </div>
                )}
              </div>

              {/* The cards of this group. Fixed size, no scrolling. */}
              <div className="flex h-26 items-center justify-center overflow-hidden">
                {empty ? (
                  <span className="text-center text-[10px] text-white/70">Drop here</span>
                ) : (
                  g.map((c, k) => (
                    <div
                      key={c}
                      onPointerDown={(e) => onCardDown(e, c)}
                      className="shrink-0 touch-none select-none"
                      style={{ marginLeft: k === 0 ? 0 : -12 }}   // overlap so 4 cards fit
                    >
                      <Card
                        code={c}
                        size="xs"
                        style={{ width: 28, height: 44 }}
                        playable={sel.includes(c)}
                        highlight={rankOf(c) === gs.joker_rank}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Loose cards: one row, highest first. Drop here to take a card out of its group. */}
      <div
        data-drop="ungrouped"
        className={"mb-3 rounded-xl bg-green-900/40 p-2 " + (over === "ungrouped" ? "ring-4 ring-yellow-300" : "")}
      >
        <p className="mb-1 text-xs font-semibold text-white">Loose cards · {gs.my_ungrouped.length}</p>
        <div className="flex min-h-18 flex-nowrap items-center overflow-x-auto pb-1 pt-2">
          {looseSorted.map((c, i) => cardBox(c, i))}
        </div>
      </div>

      {/* All buttons in one row */}
      <div className="mb-2 flex gap-2 text-xs">
        <button
          disabled={gs.round_over || selUngrouped.length < 3 || selUngrouped.length > 4 || groups.length >= 4}
          onClick={makeGroup}
          className="flex-1 rounded bg-green-500 p-2 font-semibold text-white disabled:opacity-40"
        >
          Make group
        </button>
        <button
          disabled={gs.round_over || selGrouped.length === 0}
          onClick={removeSelected}
          className="flex-1 rounded bg-gray-700 p-2 font-semibold text-white disabled:opacity-40"
        >
          Remove from group
        </button>
        <button
          disabled={!inDiscard || selUngrouped.length !== 1}
          onClick={discard}
          className="flex-1 rounded bg-orange-600 p-2 font-bold text-white disabled:opacity-40"
        >
          Discard selected
        </button>
      </div>

      {hint && <p className="mb-2 text-center text-xs text-white/80">{hint}</p>}
      <p className="rounded bg-green-500 p-2 text-center text-sm">{gs.message}</p>
      <div className="mt-2 text-center">
        <Link to="/" className="text-xs text-white/70 underline">Main menu</Link>
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

      {/* Round result (dark text, because the pop-up card is white) */}
      {gs.round_over && (
        <div className="text-black">
          <ResultOverlay
            title={`${names[gs.winner]} wins the round`}
            subtitle="The winner gets the loser's loose card points"
            rows={names.map((n, s) => ({
              name: n,
              you: s === me,
              detail: `+${gs.round_points[s]}`,
              total: gs.scores[s],
              good: s === gs.winner,
            }))}
            matchOver={false}
            isHost={room.is_host}
            onNext={() => send({ action: "next_round" })}
          />
        </div>
      )}
    </div>
  );
}