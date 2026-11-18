import { useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { createRoom, getRoom, joinRoom, savePlayer } from "../api";
import SeatPicker from "../components/SeatPicker";

export default function Friends() {
  const { gameId } = useParams();
  const { name } = useOutletContext();
  const navigate = useNavigate();
  const me = name || "Player";

  const [mode, setMode] = useState("single");          // Asta Chamma only
  const [createSeat, setCreateSeat] = useState(null);  // place I pick for a new team room
  const [code, setCode] = useState("");
  const [room, setRoom] = useState(null);              // the team room found by the code
  const [joinSeat, setJoinSeat] = useState(null);      // place I pick in that room
  const [error, setError] = useState("");

  const isAsta = gameId === "asta_chamma";
  // Court is always a team game. Asta Chamma is a team game in team mode.
  const isTeam = gameId === "court" || (isAsta && mode === "team");
  const emptyPlaces = [null, null, null, null];

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

  // Team rooms: look up the room first, so the player can see the free places
  async function findRoom() {
    setError("");
    setRoom(null);
    setJoinSeat(null);
    const data = await getRoom(code.trim().toUpperCase()).catch(() => ({ error: "Could not reach the server" }));
    if (data.error) {
      setError(data.error);
      return;
    }
    setRoom(data);
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">Play with friends</h1>
      {error && <p className="mb-3 text-red-600">{error}</p>}

      {/* Asta Chamma: choose single or team for the room */}
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

      {/* Create a room */}
      <h2 className="mb-2 font-semibold">Create a room</h2>
      {isTeam ? (
        <>
          <p className="mb-2 text-sm text-gray-600">Pick your team and place</p>
          <SeatPicker names={emptyPlaces} selected={createSeat} onSelect={setCreateSeat} />
          <button
            disabled={createSeat === null}
            onClick={() => go(() => createRoom(gameId, me, false, mode, createSeat))}
            className="mb-6 w-full rounded bg-green-700 p-3 text-white disabled:opacity-40"
          >
            Create a room
          </button>
        </>
      ) : (
        <button
          onClick={() => go(() => createRoom(gameId, me, false, mode))}
          className="mb-6 w-full rounded bg-green-700 p-3 text-white"
        >
          Create a room
        </button>
      )}

      {/* Join a room */}
      <h2 className="mb-2 font-semibold">Join with a code</h2>
      <div className="flex gap-2">
        <input
          className="w-full rounded border p-2 uppercase"
          placeholder="Room code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setRoom(null);
          }}
        />
        {isTeam ? (
          <button onClick={findRoom} className="rounded bg-blue-700 px-4 text-white">
            Find
          </button>
        ) : (
          <button
            onClick={() => go(() => joinRoom(code.trim().toUpperCase(), me))}
            className="rounded bg-blue-700 px-4 text-white"
          >
            Join
          </button>
        )}
      </div>

      {/* The team room we found: pick a free place, then join */}
      {isTeam && room && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-gray-600">Room {room.code}: pick your team and place</p>
          <SeatPicker names={room.seats} selected={joinSeat} onSelect={setJoinSeat} />
          <button
            disabled={joinSeat === null}
            onClick={() => go(() => joinRoom(room.code, me, joinSeat))}
            className="w-full rounded bg-blue-700 p-3 text-white disabled:opacity-40"
          >
            Join this place
          </button>
        </div>
      )}

      <Link to={`/game/${gameId}`} className="mt-6 block text-sm text-gray-600">← Back</Link>
    </div>
  );
}