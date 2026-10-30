import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { createRoom, joinRoom, savePlayer } from "../api";

export default function Friends() {
  const { gameId } = useParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { name } = useOutletContext(); // from Layout

  // Same steps for create and join: save my id, open the lobby
  async function go(action) {
    try {
      const data = await action();
      savePlayer(data);
      navigate("/room/" + data.code);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">Play with friends</h1>
      {error && <p className="mb-3 text-red-600">{error}</p>}

      <button
        onClick={() => go(() => createRoom(gameId, name))}
        className="mb-6 w-full rounded bg-green-700 p-3 text-white"
      >
        Create a room
      </button>

      <p className="mb-2 font-semibold">Or join with a code</p>
      <div className="flex gap-2">
        <input
          className="w-full rounded border p-2 uppercase"
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          onClick={() => go(() => joinRoom(code.trim().toUpperCase(), name))}
          className="rounded bg-blue-700 px-4 text-white"
        >
          Join
        </button>
      </div>
      <Link to={`/game/${gameId}`} className="mt-6 block text-sm text-gray-600">← Back</Link>
    </div>
  );
}