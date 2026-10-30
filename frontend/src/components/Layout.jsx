import { useState } from "react";
import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  const [name, setName] = useState(localStorage.getItem("player_name") || "");
  const [draft, setDraft] = useState(name);
  const [open, setOpen] = useState(!name); // ask for a name on the first visit

  function save() {
    const clean = draft.trim();
    if (!clean) return;
    localStorage.setItem("player_name", clean); // remembered on this device
    setName(clean);
    setOpen(false);
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="relative flex items-center justify-between bg-green-900 px-4 py-2 text-white">
        <Link to="/" className="font-bold">♠ Card Games</Link>

        {/* Profile badge in the corner */}
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2">
          <span className="text-sm">{name || "Set name"}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-300 font-bold text-black">
            {name ? name[0].toUpperCase() : "?"}
          </span>
        </button>

        {open && (
          <div className="absolute right-2 top-12 z-10 w-64 rounded bg-white p-3 text-black shadow-lg">
            <p className="mb-1 text-sm font-semibold">Your name</p>
            <input
              className="mb-2 w-full rounded border p-2"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Enter your name"
            />
            <button onClick={save} className="w-full rounded bg-green-700 p-2 text-white">
              Save
            </button>
          </div>
        )}
      </header>

      {/* The page goes here. Pages get the name from "context". */}
      <Outlet context={{ name, openProfile: () => setOpen(true) }} />
    </div>
  );
}