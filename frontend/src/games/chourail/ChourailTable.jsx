import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../../components/Card";
// import { placesFrom, placeText } from "../../components/places";

const CAPS = [3, 3, 3, 4];                                   // cards each group takes
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const COLOR_ORDER = ["♠", "♣", "♥", "♦"];                    // black suits first, then red
const DRAG_PX = 8;                                           // movement before a press becomes a drag

const rankOf = (c) => c.slice(0, -1);
const suitOf = (c) => c.slice(-1);

// Sort the dealt cards.
// "color"    = black suits first, then red. Highest rank first inside each suit.
// "sequence" = highest rank first, then the suit.
function sortCards(list, mode) {
  return [...list].sort((a, b) => {
    const rankDiff = RANKS.indexOf(rankOf(b)) - RANKS.indexOf(rankOf(a));
    const suitDiff = COLOR_ORDER.indexOf(suitOf(a)) - COLOR_ORDER.indexOf(suitOf(b));
    return mode === "color" ? suitDiff || rankDiff : rankDiff || suitDiff;
  });
}

// Put cards into a zone ("pool" or "g-0" to "g-3") and return the new groups,
// or null if that group does not have room.
function moveCards(arr, cards, zone) {
  const next = arr.map((g) => g.filter((c) => !cards.includes(c)));
  if (zone === "pool") return next;
  const i = Number(zone.slice(2));
  if (next[i].length + cards.length > CAPS[i]) return null;
  next[i] = [...next[i], ...cards];
  return next;
}

// Where name plates sit inside the table
const PLATE_POS = {
  top: "left-1/2 top-2 -translate-x-1/2",
  left: "left-2 top-6",
  right: "right-2 top-6",
};

// Where a shown group sits inside the table
const SHOW_POS = {
  top: "left-1/2 top-14 -translate-x-1/2",
  left: "left-1 top-[45%] -translate-y-1/2",
  right: "right-1 top-[45%] -translate-y-1/2",
  bottom: "left-1/2 bottom-3 -translate-x-1/2",
};

export default function ChourailTable({ room, send }) {
  const gs = room.game_state;
  const names = room.seats;
  const me = room.my_seat;
  const n = names.length;
  const phase = gs.phase;
  const arranging = phase === "arrange";
  const canEdit = arranging && !gs.confirmed[me];
  const check = gs.check;
  const target = gs.target;

  const [selected, setSelected] = useState([]);    // cards tapped so far
  const [sort, setSort] = useState("color");       // "color" or "sequence", alternates on each press
  const [drag, setDrag] = useState(null);          // card being dragged, and its position
  const [over, setOver] = useState(null);          // zone under the finger
  const [note, setNote] = useState("");            // short message for a move that is not allowed

  // Newest values, read by the pointer and tap handlers
  const latest = useRef({});
  useEffect(() => {
    latest.current = { arr: gs.my_arr, send };
  });

  // Only cards still in my hand can be selected
  const sel = selected.filter((c) => gs.my_hand.includes(c));

  // Running total = points from earlier deals + points of this deal
  const running = gs.totals.map((t, s) => t + gs.deal_pts[s]);
  const topRun = Math.max(...running);
  const leaderSeat = running.indexOf(topRun);
  // const places = topRun > 0 ? placesFrom(running) : null;
  // const PLACE_TEXT = ["", "text-yellow-600 font-extrabold", "text-gray-600 font-bold", "text-orange-700 font-bold"];

  const last = gs.round_history[gs.round_history.length - 1];
  const showingResult = (phase === "round_result" || phase === "deal_result") && !!last;
  const winnerNow = showingResult ? last.winner : null;
  const lastPlay = gs.plays[gs.plays.length - 1];

  // Where a player sits, seen from me: me at the bottom, then right, top, left
  const spotOf = (s) => (n === 2 ? ["bottom", "top"] : ["bottom", "right", "top", "left"])[(s - me + n) % n];

  const act = (obj) => latest.current.send({ action: "play", card: JSON.stringify(obj) });

  // Which drop zone is under this point of the screen?
  function zoneAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const zone = el && el.closest ? el.closest("[data-drop]") : null;
    return zone ? zone.getAttribute("data-drop") : null;
  }

  // Put cards into a zone. Returns true if the move was sent.
  function placeCards(cards, zone) {
    const next = moveCards(latest.current.arr, cards, zone);
    if (!next) {
      setNote(`Group ${Number(zone.slice(2)) + 1} is full`);
      return false;
    }
    setNote("");
    act({ do: "set", groups: next });
    return true;
  }

  // Tap a group or the dealt cards: the selected cards go there
  function tapZone(zone) {
    if (!canEdit) return;
    if (sel.length === 0) {
      setNote("Tap cards to select them first");
      return;
    }
    if (placeCards(sel, zone)) setSelected([]);
  }

  // GROUP button: 3 selected cards go to the first empty group of 3, 4 cards to Group 4
  function groupSelected() {
    const k = sel.length;
    const options = k === 4 ? [3] : k === 3 ? [0, 1, 2] : [];
    const slot = options.find((i) => latest.current.arr[i].length === 0);
    if (slot === undefined) {
      setNote(k < 3 ? "Select 3 cards (or 4 for Group 4)" : "No empty group fits these cards");
      return;
    }
    if (placeCards(sel, `g-${slot}`)) setSelected([]);
  }

  // Clear: take every card out of the groups
  function clearAll() {
    setSelected([]);
    setNote("");
    act({ do: "clear" });
  }

  // READY: lock the arrangement
  function ready() {
    act({ do: "confirm" });
  }

  // A drag that ends on a zone
  function dropOn(card, zone) {
    if (!zone) return;
    if (zone === "pool" || zone.startsWith("g-")) placeCards([card], zone);
  }

  // Press a card. Moving it a little starts a drag. Lifting without moving selects or unselects it.
  function pressCard(e, card) {
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
        dropOn(card, zoneAt(ev.clientX, ev.clientY));
        setDrag(null);
        setOver(null);
      } else {
        setSelected((s) => (s.includes(card) ? s.filter((c) => c !== card) : [...s, card]));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // One card in a row. Selected cards lift up with a green border.
  const cardEl = (c, k, overlap) => (
    <div
      key={c}
      data-card
      onPointerDown={(e) => pressCard(e, c)}
      className={"shrink-0 touch-none select-none " + (drag && drag.card === c ? "opacity-40" : "")}
      style={{ marginLeft: k === 0 ? 0 : overlap }}
    >
      <Card code={c} size="sm" playable={sel.includes(c)} />
    </div>
  );

  // One group in the row. An empty group is not shown, so the row only shows cards.
  const groupSeg = (i) => {
    const g = gs.my_arr[i] || [];
    if (g.length === 0) return null;
    const zone = `g-${i}`;
    const full = g.length === CAPS[i];
    const wrong = check.errors.some((e) => e.includes(`Group ${i + 1}`));
    const line = !full ? "bg-white/30" : wrong ? "bg-red-500" : "bg-green-500";
    return (
      <div
        key={zone}
        data-drop={zone}
        onClick={(e) => {
          if (!e.target.closest("[data-card]")) tapZone(zone);
        }}
        className={"mr-3 flex shrink-0 cursor-pointer flex-col " + (over === zone ? "opacity-90" : "")}
      >
        <div className="flex min-h-[4.5rem] items-end">
          {g.map((c, k) => cardEl(c, k, -20))}
        </div>
        <div className={"mt-1 h-1 rounded-full " + line} />
      </div>
    );
  };

  // The dealt cards: one row, sorted by the Sort button
  const poolSeg = () => (
    <div
      data-drop="pool"
      onClick={(e) => {
        if (!e.target.closest("[data-card]")) tapZone("pool");
      }}
      className={"flex min-w-[4rem] shrink-0 cursor-pointer flex-col " + (over === "pool" ? "opacity-90" : "")}
    >
      <div className="flex min-h-[4.5rem] items-end">
        {sortCards(gs.my_pool, sort).map((c, k) => cardEl(c, k, -20))}
      </div>
      <div className="mt-1 h-1 rounded-full bg-white/40" />
    </div>
  );
  
  // A name plate. Highlighted on the player's turn (arranging) or while their group is shown.
  const plate = (s) => {
    const active = arranging ? !gs.confirmed[s] : phase === "reveal" && lastPlay && lastPlay.seat === s;
    return (
      <div
        className={
          "min-w-[6.5rem] rounded-md border-2 px-2 py-1 text-center text-white shadow " +
          (active
            ? "border-yellow-300 bg-red-700"
            : winnerNow === s
            ? "border-yellow-300 bg-red-800"
            : "border-yellow-600 bg-red-900")
        }
      >
        <div className="truncate text-xs font-bold">
          {names[s]}
          {s === me && " (you)"}
        </div>
        <div className="text-[10px] font-semibold text-yellow-200">
          {running[s]}/{target}
          {arranging && (gs.confirmed[s] ? " · ready" : ` · ${gs.arranged[s]}/13`)}
        </div>
      </div>
    );
  };

  // The group a player has shown this round, inside the table in front of them
  const shownGroup = (s) => {
    const play = gs.plays.find((p) => p.seat === s);
    if (!play) return null;
    const won = winnerNow === s;
    return (
      <div key={`shown-${s}`} className={"absolute z-10 " + SHOW_POS[spotOf(s)]}>
        <div className={"flex rounded-md p-1 " + (won ? "ring-2 ring-yellow-300" : "")}>
          {play.cards.map((c, k) => (
            <div key={c} style={{ marginLeft: k === 0 ? 0 : -16 }}>
              <Card code={c} size="xs" />
            </div>
          ))}
        </div>
        <p className="text-center text-[9px] font-bold text-white drop-shadow">{play.name}</p>
      </div>
    );
  };

  // What is shown in the middle of the table
  const centre = () => {
    if (arranging) {
      if (gs.confirmed[me]) {
        return <p className="text-center text-xs font-bold tracking-wide text-yellow-200">WAITING FOR OTHER PLAYERS...</p>;
      }
      return (
        <div className="flex flex-col items-center">
          <button
            disabled={!canEdit || !check.ok}
            onClick={ready}
            className="rounded-md border-4 border-yellow-400 bg-gradient-to-b from-green-500 to-green-700 px-8 py-2 text-base font-extrabold tracking-wide text-white shadow-lg disabled:from-gray-500 disabled:to-gray-600 disabled:opacity-60"
          >
            READY
          </button>
          <p className="mt-2 text-center text-[10px] font-bold tracking-wide text-yellow-200">
            {check.ok ? 'TAP "READY"' : 'ARRANGE CARDS, THEN TAP "READY"'}
          </p>
        </div>
      );
    }
    if (phase === "final") {
      return (
        <div className="text-center">
          <p className="text-xs font-bold tracking-wide text-yellow-200">GAME OVER</p>
          <p className="text-base font-extrabold text-yellow-300">{gs.winners.map((i) => names[i]).join(" & ")}</p>
          <p className="text-xs">reached {target} first</p>
        </div>
      );
    }
    if (showingResult) {
      return (
        <div className="text-center">
          <p className="text-3xl font-extrabold text-yellow-300 drop-shadow">+{last.points}</p>
          <p className="text-xs font-semibold">
            {names[last.winner]} wins round {last.round}
          </p>
        </div>
      );
    }
    return <p className="text-xs font-bold tracking-wide text-yellow-200">ROUND {gs.round} OF 4</p>;
  };

  // Button style, like Rummy
  const btn = (color) =>
    "rounded-md border-2 border-yellow-500 py-2 text-sm font-extrabold uppercase text-white shadow disabled:opacity-40 " + color;

  let resultLine = null;
  if (phase === "round_result" && last) {
    resultLine = `Round ${last.round}: ${names[last.winner]} wins with ${last.name} · +${last.points} points. Next round starts automatically.`;
  } else if (phase === "deal_result") {
    resultLine = `Deal ${gs.deal_no} finished. The next deal starts automatically.`;
  } else if (phase === "final") {
    resultLine = `Game over! ${gs.winners.map((i) => names[i]).join(" & ")} reached ${target} first.`;
  }

  return (
    <div className="relative mx-auto w-full max-w-md rounded-3xl bg-green-900 p-3 text-white shadow-inner">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold">Chourail · Deal {gs.deal_no}</span>
        <span className="rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-black">
          Round {gs.round} of 4
        </span>
      </div>
      <p className="mb-2 text-center text-xs text-white/80">
        First to {target} wins · Leader {names[leaderSeat]} with {topRun}
      </p>

      {/* The table, like Rummy: name plates on the edges, shown groups inside, READY in the centre */}
      <div className="relative h-[22rem] rounded-[3rem] border-[10px] border-amber-700 bg-gradient-to-b from-blue-500 to-blue-700 shadow-inner">
        {names.map((_, s) =>
          s === me ? null : (
            <div key={`plate-${s}`} className={"absolute z-20 " + PLATE_POS[spotOf(s)]}>
              {plate(s)}
            </div>
          )
        )}
        {names.map((_, s) => shownGroup(s))}
        <div className="absolute inset-0 flex items-center justify-center px-20">{centre()}</div>
      </div>

      {/* My name plate, below the table */}
      <div className="mt-3 flex justify-center">{plate(me)}</div>

      {/* My row: the four groups and the dealt cards, all in ONE row */}
      <div className="mt-2 flex min-h-[9rem] items-end overflow-x-auto pb-2 pt-4">
        {[0, 1, 2, 3].map(groupSeg)}
        {arranging && poolSeg()}
      </div>

      {arranging && (
        <>
          {/* Buttons: Group, Sort (alternates Color / Sequence), Clear */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              disabled={!canEdit || sel.length < 3 || sel.length > 4}
              onClick={groupSelected}
              className={btn("bg-purple-800")}
            >
              Group
            </button>
            <button onClick={() => setSort((s) => (s === "color" ? "sequence" : "color"))} className={btn("bg-cyan-700")}>
              Sort: {sort === "color" ? "Color" : "Sequence"}
            </button>
            <button disabled={!canEdit} onClick={clearAll} className={btn("bg-gray-600")}>
              Clear
            </button>
          </div>

          {sel.length > 0 && <p className="mt-2 text-center text-xs text-yellow-200">Selected: {sel.length}</p>}
          {note && <p className="mt-2 rounded bg-red-600/80 p-2 text-center text-xs">{note}</p>}
          {gs.confirmed[me] && (
            <p className="mt-2 text-center text-xs">You are ready. Waiting for the other players...</p>
          )}
        </>
      )}

      {resultLine && (
        <p className="mt-3 rounded bg-yellow-200 p-2 text-center text-xs font-semibold text-black">{resultLine}</p>
      )}

      {/* Points table: black text on white, with the Place column */}
      {/* <div className="mt-3 overflow-x-auto rounded-xl bg-white p-2 text-black">
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
              return (
                <tr key={s} className={winnerNow === s ? "bg-yellow-100" : ""}>
                  <td className={"text-left " + style}>{nm}</td>
                  {gs.round_pts.map((r, k) => (
                    <td key={k} className={style}>
                      {r[s]}
                    </td>
                  ))}
                  <td className={style}>{gs.deal_pts[s]}</td>
                  <td className={style}>{running[s]}</td>
                  <td className={"font-bold " + style}>{place ? placeText(place) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div> */}

      <p className="mt-2 rounded bg-yellow-100 p-2 text-center text-sm text-black">{gs.message}</p>

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