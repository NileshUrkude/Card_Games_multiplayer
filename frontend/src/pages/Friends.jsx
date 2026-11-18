import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { createRoom, joinRoom, savePlayer } from "../api";

export default function Friends() {
  const { gameId } = useParams();
  const { name } = useOutletContext();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("single");   // used by Asta Chamma only
  const [error, setError] = useState("");
  const isAsta = gameId === "asta_chamma";

  // Same steps for create and join: save my id, then open the room
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

      {/* Asta Chamma: choose the mode for the room */}
      {isAsta && (
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setMode("single")}
            className={"flex-1 rounded p-2 " + (mode === "single" ? "bg-green-700 text-white" : "bg-gray-200")}
          >
            Single
          </button>
          <button
            onClick={() => setMode("team")}
            className={"flex-1 rounded p-2 " + (mode === "team" ? "bg-green-700 text-white" : "bg-gray-200")}
          >
            Team 2 vs 2
          </button>
        </div>
      )}

      <button
        onClick={() => go(() => createRoom(gameId, name || "Player", false, mode))}
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
          onClick={() => go(() => joinRoom(code.trim().toUpperCase(), name || "Player"))}
          className="rounded bg-blue-700 px-4 text-white"
        >
          Join
        </button>
      </div>
      <Link to={`/game/${gameId}`} className="mt-6 block text-sm text-gray-600">← Back</Link>
    </div>
  );
}