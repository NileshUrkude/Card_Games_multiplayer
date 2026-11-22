import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getGames } from "../api";

// Games that are board games. They are shown at the bottom of the page.
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
  const [games, setGames] = useState([]);
  const { name, openProfile } = useOutletContext(); // from Layout
  const navigate = useNavigate();

  // Load the game list once when the page opens
  useEffect(() => {
    getGames().then(setGames);
  }, []);

  function pickGame(id) {
    if (!name) {
      openProfile();          // no name yet: open the profile box first
      return;
    }
    navigate("/game/" + id);
  }

  // Card games go in the grid. Board games go at the bottom.
  const cardGames = games.filter((g) => !BOARD_GAMES.includes(g.id));
  const boardGames = games.filter((g) => BOARD_GAMES.includes(g.id));

  // One game tile (image, SOON badge and name)
  const tile = (g) => (
    <button
      key={g.id}
      onClick={() => pickGame(g.id)}
      className="relative flex flex-col items-center rounded-xl bg-green-800 p-3 text-white shadow"
    >
      {g.soon && (
        <span className="absolute right-2 top-2 z-10 rounded bg-yellow-300 px-2 py-0.5 text-[10px] font-bold text-black">
          SOON
        </span>
      )}
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-black/20">
        <GameImage id={g.id} fallback={g.icon} />
      </div>
      <span className="mt-2 text-sm font-semibold">{g.name}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-bold">Choose a game</h1>

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
    </div>
  );
}