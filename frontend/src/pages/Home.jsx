import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getGames, cachedGames } from "../api";

// Games that are board games. They are shown in their own section at the bottom.
const BOARD_GAMES = ["asta_chamma"];

// Each tile shows the image frontend/public/games/<id>.png, cropped to one fixed square size.
// If that image is missing, the tile shows the text from the server instead.
function GameImage({ id, fallback }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return <span className="text-3xl font-bold">{fallback}</span>;
  }
  return (
    <img
      src={`/games/${id}.png`}
      alt=""
      onError={() => setMissing(true)}
      className="h-full w-full object-cover"
    />
  );
}

export default function Home() {
  // Start with the last list we saw, so tiles appear at once on repeat visits
  const [games, setGames] = useState(cachedGames);
  // "connecting" while waiting for the server, "ready" when tiles are shown, "failed" if it gave up
  const [status, setStatus] = useState(() => (cachedGames().length ? "ready" : "connecting"));
  // Goes up by one each time "Try again" is pressed, which asks for the list again
  const [attempt, setAttempt] = useState(0);
  const { name, openProfile } = useOutletContext(); // from Layout
  const navigate = useNavigate();

  // Ask for the game list. This also wakes a sleeping server.
  // It runs when the page opens, and again each time "attempt" changes.
  useEffect(() => {
    let cancelled = false;   // stops a late answer from updating a page that was left

    getGames()
      .then((list) => {
        if (cancelled) return;
        setGames(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // "Try again" shows the connecting message and asks the server again
  function tryAgain() {
    setStatus("connecting");
    setAttempt((a) => a + 1);
  }

  function pickGame(id) {
    if (!name) {
      openProfile();          // no name yet: open the profile box first
      return;
    }
    navigate("/game/" + id);
  }

  // Card games go in the grid. Board games go in their own section at the bottom.
  const cardGames = games.filter((g) => !BOARD_GAMES.includes(g.id));
  const boardGames = games.filter((g) => BOARD_GAMES.includes(g.id));

  // One game tile: fixed-size image and the name under it
  const tile = (g) => (
    <button
      key={g.id}
      onClick={() => pickGame(g.id)}
      className="flex flex-col items-center rounded-xl bg-green-800 p-3 text-white shadow"
    >
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-black/20">
        <GameImage id={g.id} fallback={g.icon} />
      </div>
      <span className="mt-2 text-sm font-semibold">{g.name}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-bold">Choose a game</h1>

      {status === "connecting" && games.length === 0 && (
        <p className="mb-4 rounded bg-yellow-100 p-3 text-center text-sm text-black">
          Connecting to the game server... the first visit after a break can take up to a minute.
        </p>
      )}

      {status === "failed" && (
        <div className="mb-4 rounded bg-red-100 p-3 text-center text-sm text-black">
          <p>Could not reach the game server.</p>
          <button onClick={tryAgain} className="mt-2 rounded bg-green-700 px-4 py-1 text-white">
            Try again
          </button>
        </div>
      )}

      {/* Card games */}
      <div className="grid grid-cols-2 gap-4">{cardGames.map(tile)}</div>

      {/* Board games, at the bottom of the page */}
      {boardGames.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-gray-600">
            Board game
          </h2>
          <div className="grid grid-cols-2 gap-4">{boardGames.map(tile)}</div>
        </>
      )}

      {/* Footer: who made this */}
      <footer className="mt-10 border-t border-gray-300 pt-5 text-center text-sm text-gray-600">
        <p className="text-xl">---Games---</p>

        <p>
          Created by <span className="font-semibold text-gray-800">Nilesh Urkude</span>
        </p>

        <p>For feedback and suggestions, please contact us at nileshburkude@gmail.com</p>
      </footer>
    </div>
  );
}