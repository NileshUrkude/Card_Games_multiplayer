import { useEffect, useState } from "react";

// How long the shells roll before they land (milliseconds)
const ROLL_TIME = 900;

// The shell animation. Each shell rolls in a slightly different way.
const KEYFRAMES = `
@keyframes shellRoll {
  0%   { transform: translate(0px, 0px) rotate(0deg); }
  25%  { transform: translate(-10px, -18px) rotate(120deg); }
  50%  { transform: translate(12px, -6px) rotate(240deg); }
  75%  { transform: translate(-6px, -12px) rotate(330deg); }
  100% { transform: translate(0px, 0px) rotate(360deg); }
}`;

// One cowrie shell. "open" = the slit (open side) faces up.
function Shell({ index, rolling, open }) {
  return (
    <div
      className="relative h-10 w-12 rounded-[50%] border border-amber-200 bg-linear-to-b from-white to-amber-100 shadow-md"      style={{
        // While rolling, play the animation. Each shell starts a little later.
        animation: rolling ? `shellRoll 0.9s ease-in-out ${index * 0.08}s infinite` : "none",
      }}
    >
      {/* The dark slit is the open side of the shell */}
      {open && (
        <span className="absolute left-2 right-2 top-1/2 h-2 -translate-y-1/2 rounded-full bg-amber-900/80" />
      )}
    </div>
  );
}

// The throw box.
// canThrow   = true when it is my turn to throw (shows the button)
// onThrow    = what to do when the button is pressed
// openSides  = how many shells land open (0 to 4), from the server
// throwValue = houses moved by the last throw
// extra      = true if the last throw gives an extra turn
// throwId    = counts throws; a new value makes the shells roll
// label      = the short line at the top of the box
export default function ThrowTray({ canThrow, onThrow, openSides, throwValue, extra, throwId, label }) {
  // seenId = the last throw this box has already reacted to
  const [seenId, setSeenId] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState([false, false, false, false]);

  // A new throwId means a new throw. We notice it while drawing (not inside an effect),
  // which is the React way to react to a change in a prop.
  if (throwId !== seenId) {
    setSeenId(throwId);
    setRolling(throwId > 0); // roll only after a real throw, not on the first draw
  }

  // While the shells roll, wait ROLL_TIME, then land them.
  // A timer is the right place for this, so it lives inside the effect.
  useEffect(() => {
    if (!rolling) return;
    const timer = setTimeout(() => {
      // Pick random shells to land open, as many as the server said
      const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
      const open = [false, false, false, false];
      for (let i = 0; i < openSides; i++) open[order[i]] = true;
      setLanded(open);
      setRolling(false);
    }, ROLL_TIME);
    return () => clearTimeout(timer);
  }, [rolling, openSides]);

  return (
    <div
      className="relative mt-3 overflow-hidden rounded-2xl border-4 border-amber-800 p-4 text-center shadow-inner"
      style={{
        backgroundImage: "url(/cowries.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark layer over the photo so the shells and text can be read */}
      <div className="absolute inset-0 bg-amber-900/70" />

      <div className="relative">
        <p className="mb-2 text-sm font-bold text-white">{label}</p>

        <div className="flex justify-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Shell key={i} index={i} rolling={rolling} open={!rolling && landed[i]} />
          ))}
        </div>

        <p className="mt-2 text-sm font-semibold text-amber-100">
          {rolling
            ? "Throwing..."
            : throwValue
            ? `${throwValue} houses${extra ? " · extra turn!" : ""}`
            : "No throw yet"}
        </p>

        {canThrow && (
          <button
            onClick={onThrow}
            className="mt-3 w-full rounded-lg bg-orange-500 p-3 font-bold text-white shadow active:scale-95"
          >
            Throw cowries
          </button>
        )}
      </div>

      {/* The shell animation is defined here, so this file works on its own */}
      <style>{KEYFRAMES}</style>
    </div>
  );
}