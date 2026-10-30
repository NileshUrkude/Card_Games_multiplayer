import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { getGames, createRoom, savePlayer } from "../api";

export default function GameMenu() {
  const { gameId } = useParams();
  const [game, setGame] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { name } = useOutletContext(); // from Layout

  // Find this game's name and icon from the list
  useEffect(() => {
    getGames().then((list) => setGame(list.find((g) => g.id === gameId)));
  }, [gameId]);

  // "Play": make a room where every other seat is a bot
  async function playWithBots() {
    try {
      const data = await createRoom(gameId, name, true);
      savePlayer(data);
      navigate("/room/" + data.code);
    } catch (e) {
      setError(e.message);
    }
  }

  if (!game) return <p className="p-6">Loading...</p>;

  return (
    <div className="mx-auto max-w-md p-6 text-center">
      <div className="text-5xl">{game.icon}</div>
      <h1 className="mb-6 text-2xl font-bold">{game.name}</h1>
      {error && <p className="mb-3 text-red-600">{error}</p>}

      <button onClick={playWithBots} className="mb-3 w-full rounded bg-green-700 p-3 text-white">
        Play (with bots)
      </button>
      <Link
        to={`/game/${gameId}/friends`}
        className="block w-full rounded bg-blue-700 p-3 text-white"
      >
        Play with friends
      </Link>
      <Link to="/" className="mt-6 block text-sm text-gray-600">← All games</Link>
    </div>
  );
}