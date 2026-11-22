import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { placesFrom, placeText } from "./places";

// Text and badge colours for the first three places
const PLACE_STYLE = {
  1: { row: "text-yellow-600 font-extrabold", badge: "bg-yellow-300 text-black" },
  2: { row: "text-gray-600 font-bold", badge: "bg-gray-300 text-black" },
  3: { row: "text-orange-700 font-bold", badge: "bg-orange-300 text-black" },
};

// rows = [{ name, you, detail, total, good, place }]
//   place = the place to show. If a row has none, it is worked out from its total.
//   good  = highlight the row when there is no place
// lowerIsBetter = true when the smallest total is the best (Satte pe Satta)
export default function ResultOverlay({
  title, subtitle, rows, matchOver, isHost, onNext, lowerIsBetter = false,
}) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(id);
  }, []);

  if (!visible) return null;

  // Hidden: only a small button to bring the result back
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-black shadow"
      >
        Show result
      </button>
    );
  }

  // Places worked out from the totals, for rows that do not give their own place
  const computed = placesFrom(
    rows.map((r) => (typeof r.total === "number" ? r.total : 0)),
    lowerIsBetter
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-3xl bg-black/70 p-3">
      <div className="w-full max-w-xs rounded-xl bg-white p-4 text-center text-black shadow-xl">
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && <p className="mb-2 text-sm text-gray-600">{subtitle}</p>}

        {rows.map((r, i) => {
          const place = r.place ?? (typeof r.total === "number" ? computed[i] : undefined);
          const style = PLACE_STYLE[place];
          const rowClass = style
            ? `${style.row} bg-white ring-1 ring-gray-300`
            : r.good
            ? "bg-green-200 font-bold ring-2 ring-green-500"
            : "bg-gray-100";
          return (
            <div
              key={i}
              className={"mb-1 flex items-center justify-between rounded px-2 py-1 text-sm " + rowClass}
            >
              <span className="flex min-w-0 items-center gap-2">
                {place && (
                  <span
                    className={
                      "shrink-0 rounded px-1.5 text-[11px] font-bold " + (style ? style.badge : "bg-gray-200")
                    }
                  >
                    {placeText(place)}
                  </span>
                )}
                <span className="truncate">
                  {r.good && "★ "}
                  {r.name}
                  {r.you && " (you)"}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block">{r.detail}</span>
                <span className="block text-xs font-normal text-gray-600">Total {r.total}</span>
              </span>
            </div>
          );
        })}

        {matchOver ? (
          <Link to="/" className="mt-3 block rounded bg-green-700 p-2 font-semibold text-white">
            Back to games
          </Link>
        ) : isHost ? (
          <button onClick={onNext} className="mt-3 w-full rounded bg-green-700 p-2 font-semibold text-white">
            Next round
          </button>
        ) : (
          <p className="mt-3 text-sm text-gray-600">Waiting for the host...</p>
        )}

        <button onClick={() => setOpen(false)} className="mt-2 text-xs text-gray-500 underline">
          View table
        </button>
      </div>
    </div>
  );
}