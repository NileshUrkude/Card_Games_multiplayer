import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// Result card shown over the table when a round or the match ends.
// rows = [{ name, you, detail, total, good }]  (good = highlighted green)
export default function ResultOverlay({ title, subtitle, rows, matchOver, isHost, onNext }) {
  const [visible, setVisible] = useState(false); // appears 1.2 sec after the last card
  const [open, setOpen] = useState(true);        // the player can hide it to see the table

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

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-3xl bg-black/70 p-3">
      <div className="w-full max-w-xs rounded-xl bg-white p-4 text-center shadow-xl">
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle && <p className="mb-2 text-sm text-gray-600">{subtitle}</p>}

        {/* One row per player. Green + star = highlighted. */}
        {rows.map((r, i) => (
          <div
            key={i}
            className={
              "mb-1 flex items-center justify-between rounded px-2 py-1 text-sm " +
              (r.good ? "bg-green-200 font-bold ring-2 ring-green-500" : "bg-gray-100")
            }
          >
            <span>
              {r.good && "★ "}
              {r.name}
              {r.you && " (you)"}
            </span>
            <span className="text-right">
              <span className="block">{r.detail}</span>
              <span className="block text-xs font-normal text-gray-600">Total {r.total}</span>
            </span>
          </div>
        ))}

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