import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/Card";
import ResultOverlay from "../../components/ResultOverlay";

const DRAG_PX = 8;          // movement before a press becomes a drag
const MAX_GROUP = 4;        // most cards in one group
const MAX_GROUPS = 4;       // most groups
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const rankOf = (c) => c.slice(0, -1);

// Move cards to a target and return the new groups, or null if the move is not allowed.
// target = {to:"group", index} | {to:"new"} | {to:"loose"}
function moveCards(groups, cards, target) {
  // Take the cards out of every group first. Group positions are kept.
  const stripped = groups.map((g) => g.filter((c) => !cards.includes(c)));
  let result;

  if (target.to === "loose") {
    result = stripped;
  } else if (target.to === "new") {
    if (stripped.filter((g) => g.length > 0).length >= MAX_GROUPS) return null;
    result = [...stripped, [...cards]];
  } else {
    const i = target.index;
    if (i < 0 || i >= stripped.length) return null;
    if (stripped[i].length + cards.length > MAX_GROUP) return null;
    result = stripped.map((g, k) => (k === i ? [...g, ...cards] : g));
  }
  return result.filter((g) => g.length > 0);
}

export default function RummyTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;
  const other = 1 - me;

  const myTurn = gs.turn === me && !gs.round_over && !gs.hold;
  const canDraw = myTurn && gs.phase === "draw";
  const canDiscard = myTurn && gs.phase === "discard";
  const isJoker = (c) => rankOf(c) === gs.joker_rank;
  const groups = gs.my_groups;
  const looseSorted = [...gs.my_ungrouped].sort(
    (a, b) => RANKS.indexOf(rankOf(b)) - RANKS.indexOf(rankOf(a))
  );

  const [selected, setSelected] = useState([]);   // cards tapped so far
  const [drag, setDrag] = useState(null);         // card being dragged, and its position
  const [over, setOver] = useState(null);         // zone under the finger
  const [note, setNote] = useState("");           // short message for a move that is not allowed

  // Newest values, read by the pointer and tap handlers
  const latest = useRef({});
  useEffect(() => {
    latest.current = { groups, loose: gs.my_ungrouped, canDraw, canDiscard, send };
  });

  // Only cards that are still in my hand can be selected
  const sel = selected.filter((c) => gs.my_hand.includes(c));

  const act = (obj) => latest.current.send({ action: "play", card: JSON.stringify(obj) });

  // Which drop zone is under this point of the screen?
  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const zone = el && el.closest ? el.closest("[data-drop]") : null;
    return zone ? zone.getAttribute("data-drop") : null;
  }

  // Put cards into a target. Returns true if the move was sent.
  function placeCards(cards, target) {
    const next = moveCards(latest.current.groups, cards, target);
    if (!next) {
      setNote(target.to === "new" ? "You can have at most 4 groups" : "That group is full (4 cards at most)");
      return false;
    }
    setNote("");
    act({ do: "arrange", groups: next });
    return true;
  }

  // Tap a group or the loose area: the selected cards go there
  function placeSelected(target) {
    if (sel.length === 0) {
      setNote("Tap cards to select them first");
      return;
    }
    if (placeCards(sel, target)) setSelected([]);
  }

  // GROUP button: the selected cards (3 or 4) become a new group
  function groupSelected() {
    if (sel.length < 3 || sel.length > 4) {
      setNote("Select 3 or 4 cards to make a group");
      return;
    }
    if (placeCards(sel, { to: "new" })) setSelected([]);
  }

  // Discard one loose card
  function discardCard(card) {
    if (!latest.current.canDiscard) {
      setNote("You can discard after you draw");
      return;
    }
    if (!latest.current.loose.includes(card)) {
      setNote("Take this card out of its group first");
      return;
    }
    setNote("");
    setSelected([]);
    act({ do: "discard", card });
  }

  // DISCARD button: discard the one selected loose card
  function discardSelected() {
    if (sel.length !== 1) {
      setNote("Select one loose card to discard");
      return;
    }
    discardCard(sel[0]);
  }

  // Tap the discard pile: discard the selected card, or draw from the pile
  function discardPileTap() {
    if (latest.current.canDiscard) {
      discardSelected();
    } else if (latest.current.canDraw) {
      act({ do: "draw", pile: "discard" });
    } else {
      setNote("Wait for your turn");
    }
  }

  // Tap the face-down pile: draw a card
  function deckTap() {
    if (canDraw) act({ do: "draw", pile: "deck" });
    else setNote("Wait for your turn to draw");
  }

  // A drag that ends on a zone
  function dropOn(card, zone) {
    if (!zone) return;
    if (zone === "discard") return discardCard(card);
    if (zone === "loose") return placeCards([card], { to: "loose" });
    if (zone.startsWith("group-")) {
      return placeCards([card], { to: "group", index: Number(zone.slice(6)) });
    }
  }

  // Tap a card to select it or unselect it
  function toggleSelect(card) {
    setSelected((s) => (s.includes(card) ? s.filter((c) => c !== card) : [...s, card]));
  }

  // Press a card. Moving it a little starts a drag. Lifting without moving is a tap.
  function pressCard(e, card) {
    if (gs.round_over) return;
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
        dropOn(card, zoneAt(ev.clientX, ev.clientY));
        setDrag(null);
        setOver(null);
      } else {
        toggleSelect(card);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // One card in a row. Selected cards lift up with a green border.
  // The card just drawn gets a blue outline. Jokers glow and show a 🃏.
  const cardEl = (c, k, overlap) => {
    const fresh = c === gs.drawn_card;
    return (
      <div
        key={c}
        data-card
        onPointerDown={(e) => pressCard(e, c)}
        className={"shrink-0 touch-none select-none " + (drag && drag.card === c ? "opacity-40" : "")}
        style={{ marginLeft: k === 0 ? 0 : overlap }}
      >
        <div className={"relative rounded-md " + (fresh ? "ring-4 ring-blue-500" : "")}>
          <Card code={c} size="sm" playable={sel.includes(c)} highlight={isJoker(c)} />
        </div>
      </div>
    );
  };


  // A player name plate. Highlighted on that player's turn.
  const plate = (s, sub) => {
    const active = gs.turn === s && !gs.round_over;
    return (
      <div
        className={
          "min-w-18 rounded-md border-2 px-2 py-1 text-center text-xs font-bold text-white shadow " +
          (active ? "border-yellow-300 bg-red-700" : "border-yellow-600 bg-red-900")
        }
      >
        <div className="truncate">
          {names[s]}
          {s === me && " (you)"}
        </div>
        <div className="text-[10px] font-semibold text-yellow-200">
          {gs.scores[s]}/{gs.target} · {sub}
        </div>
      </div>
    );
  };

  // Instruction in the centre of the table
  let banner;
  if (gs.round_over) banner = "ROUND OVER";
  else if (!myTurn) banner = `${names[gs.turn]} is playing...`;
  else if (gs.phase === "draw") banner = "DRAW A CARD";
  else banner = gs.timer_left != null ? `DISCARD A CARD · ${gs.timer_left}s` : "DISCARD A CARD";

  const rows = names.map((nm, s) => ({
    name: nm,
    you: s === me,
    detail: `+${gs.round_points[s]}`,
    total: gs.scores[s],
    good: s === gs.winner,
  }));

  // Button state
  const canGroup = gs.round_over === false && sel.length >= 3 && sel.length <= 4 && groups.length < MAX_GROUPS;
  const canDiscardBtn = canDiscard && sel.length === 1 && gs.my_ungrouped.includes(sel[0]);

  return (
    <div className="relative mx-auto w-full max-w-md rounded-3xl bg-green-900 p-3 text-white shadow-inner">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold">Rummy · Round {gs.round}</span>
        <span className="rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-black">
          Joker: {gs.joker_rank}
        </span>
      </div>

      {/* The table, like the other games */}
      <div className="relative h-48 rounded-[3rem] border-10px border-amber-700 bg-linear-to-b from-blue-500 to-blue-700 shadow-inner">
        {/* Opponent name plate, at the top */}
        <div className="absolute left-1/2 top-2 -translate-x-1/2">
          {plate(other, `${gs.opp_count} cards`)}
        </div>

        {/* Centre: joker card, face-down pile, face-up discard pile */}
        <div className="absolute inset-x-0 top-[55%] flex -translate-y-1/2 items-center justify-center gap-4">
          <div className="-rotate-12">
            <Card code={gs.indicator} size="sm" highlight />
          </div>

          <button type="button" onClick={deckTap} className="relative">
            <Card back size="sm" />
            <span className="absolute -bottom-4 left-0 right-0 text-center text-[10px] font-semibold">
              Draw {gs.draw_count}
            </span>
          </button>

          <div
            data-drop="discard"
            onClick={discardPileTap}
            className={
              "relative flex cursor-pointer flex-col items-center rounded-md " +
              (over === "discard" ? "ring-4 ring-yellow-300" : "")
            }
          >
            {gs.discard_top ? (
              <Card code={gs.discard_top} size="sm" highlight={isJoker(gs.discard_top)} />
            ) : (
              <div className="h-14 w-10 rounded border border-dashed border-white/60" />
            )}
            <span className="mt-4 text-[10px] font-semibold">Discard {gs.discard_count}</span>
          </div>
        </div>

        {/* Instruction */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-yellow-300 bg-amber-900 px-3 py-1 text-[11px] font-extrabold uppercase">
          {banner}
        </div>
      </div>

      {/* My name plate, at the bottom */}
      <div className="mt-3 flex justify-center">{plate(me, `${gs.my_hand.length} cards`)}</div>

      {/* My row: groups and loose cards in ONE row.
          Each group has a green (valid) or red (not correct) line under it.
          No extra box, so the row does not grow. */}
      <div className="mt-2 flex min-h-14 items-end overflow-x-auto pb-2 pt-4">        {groups.map((g, i) => {
          const st = gs.my_group_status[i] || { ok: false, reason: "" };
          const zone = `group-${i}`;
          return (
            <div
              key={i}
              data-drop={zone}
              title={st.ok ? "Valid group" : st.reason}
              onClick={(e) => {
                if (!e.target.closest("[data-card]")) placeSelected({ to: "group", index: i });
              }}
              className={"mr-3 flex shrink-0 cursor-pointer flex-col " + (over === zone ? "opacity-90" : "")}
            >
              <div className="flex items-end">{g.map((c, k) => cardEl(c, k, -16))}</div>
              <div className={"mt-1 h-1 rounded-full " + (st.ok ? "bg-green-500" : "bg-red-500")} />
            </div>
          );
        })}

        {/* Loose cards: same row. Tap the area to take selected cards out of their groups. */}
        <div
          data-drop="loose"
          onClick={(e) => {
            if (!e.target.closest("[data-card]")) placeSelected({ to: "loose" });
          }}
          className={"flex shrink-0 cursor-pointer flex-col " + (over === "loose" ? "opacity-90" : "")}
        >
          <div className="flex items-end">{looseSorted.map((c, k) => cardEl(c, k, -18))}</div>
          <div className="mt-1 h-1 rounded-full bg-white/40" />
        </div>
      </div>

      {/* Buttons: GROUP makes a new group from selected cards, DISCARD discards one loose card */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <button
          disabled={!canGroup}
          onClick={groupSelected}
          className="rounded-md border-2 border-yellow-500 bg-purple-800 py-2 font-extrabold uppercase text-white shadow disabled:opacity-40"
        >
          Group
        </button>
        <button
          disabled={!canDiscardBtn}
          onClick={discardSelected}
          className="rounded-md border-2 border-yellow-500 bg-orange-700 py-2 font-extrabold uppercase text-white shadow disabled:opacity-40"
        >
          Discard
        </button>
      </div>

      {sel.length > 0 && (
        <p className="mt-2 text-center text-xs text-yellow-200">Selected: {sel.length}</p>
      )}

      {note && <p className="mt-2 rounded bg-red-600/80 p-2 text-center text-xs">{note}</p>}

      <p className="mt-2 rounded bg-yellow-100 p-2 text-center text-sm text-black">{gs.message}</p>

      <div className="mt-2 text-center">
        <Link to="/" className="text-xs text-white/70 underline">
          Main menu
        </Link>
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

      {/* Round result, or the final result when someone has reached the target */}
      {gs.round_over && (
        <ResultOverlay
          title={
            gs.match_over
              ? `${names[gs.final_winner]} wins the game!`
              : `${names[gs.winner]} wins the round`
          }
          subtitle={
            gs.match_over
              ? `First to ${gs.target} points`
              : "The winner gets the loser's loose card points"
          }
          rows={rows}
          matchOver={!!gs.match_over}
          isHost={room.is_host}
          onNext={() => send({ action: "next_round" })}
        />
      )}
    </div>
  );
}