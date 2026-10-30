import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { getGames } from "../api";
import Card from "../components/Card";

export default function Home() {
  const [games, setGames] = useState([]);
  const { name, openProfile } = useOutletContext(); // from Layout
  const navigate = useNavigate();

  useEffect(() => {
    getGames().then(setGames);
  }, []);

  function pickGame(id) {
    if (!name) {
      openProfile(); // no name yet: open the profile box first
      return;
    }
    navigate("/game/" + id);
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-bold">Choose a game</h1>
      <div className="grid grid-cols-2 gap-4">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => pickGame(g.id)}
            className="flex flex-col items-center rounded-xl bg-green-800 p-5 text-white shadow"
          >
            <Card code={g.icon} size="lg" /> {/* icon "7♥" is drawn as a card */}
            <span className="mt-3 font-semibold">{g.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}