import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getGames } from "../api";

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

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-bold">Choose a game</h1>

      {/* All games in one grid. Asta Chamma comes last because it is a board game. */}
      <div className="grid grid-cols-2 gap-4">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => pickGame(g.id)}
            className="flex flex-col items-center rounded-xl bg-green-800 p-3 text-white shadow"
          >
            {/* The image box: always the same size for every game */}
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-black/20">
              <GameImage id={g.id} fallback={g.icon} />
            </div>

            {/* Game name under the image */}
            <span className="mt-2 text-sm font-semibold">{g.name}</span>
          </button>
        ))}
      </div>
      
    {/* Footer: who made this */}
    <footer className="mt-auto border-t border-gray-300 pt-5 text-center text-sm text-gray-600">
      <p className="text-xs">Card Games</p>

      <p>
        Created by <span className="font-semibold text-gray-800">Nilesh Urkude</span>
      </p>      

      <p>For feedback and suggestions, please contact us at nileshburkude@gmail.com</p>
    </footer>
    </div>
  );
}