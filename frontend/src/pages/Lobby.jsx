import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { roomSocketUrl } from "../api";
import FiveThreeTwoTable from "../games/five_three_two/FiveThreeTwoTable";
import SatteTable from "../games/satte_pe_satta/SatteTable";
import AstaTable from "../games/asta_chamma/AstaTable";

export default function Lobby() {
  const { code } = useParams();
  const [room, setRoom] = useState(null);
  const [lost, setLost] = useState(false);
  const socket = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const playerId = localStorage.getItem("player_" + code);
    if (!playerId) {
      navigate("/");
      return;
    }
    const ws = new WebSocket(roomSocketUrl(code, playerId));
    socket.current = ws;
    ws.onmessage = (e) => setRoom(JSON.parse(e.data));
    ws.onclose = () => {
      if (socket.current === ws) setLost(true);
    };
    return () => ws.close();
  }, [code, navigate]);

  // Send a message to the server, like { action: "start" }
  const send = (msg) => socket.current.send(JSON.stringify(msg));

  // Disconnected: the room is still kept on the server, and this browser remembers
  // who you are, so one refresh continues the game.
  if (lost)
    return (
      <div className="p-6 text-center">
        <p className="mb-2 font-semibold text-red-600">Disconnected</p>
        <p className="mb-4 text-sm">Refresh the page once to continue.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-green-700 px-4 py-2 text-white"
        >
          Refresh
        </button>
      </div>
    );

if (!room) return <p className="p-6">Connecting...</p>;

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="mb-3 text-2xl font-bold">{room.game_name}</h1>
      {!room.solo && (
        <p className="mb-4">
          Room code: <b className="text-xl tracking-widest">{room.code}</b>
        </p>
      )}
      
      {/* Waiting room (before the game starts) */}
      {!room.started && (
        <>
          {room.seats.map((name, i) => (
            <div key={i} className="mb-2 rounded border p-3">
              Seat {i + 1}: {name || <span className="text-gray-400">waiting...</span>}
              {i === room.my_seat && " (you)"}
            </div>
          ))}
          {room.is_host ? (
            <button
              onClick={() => send({ action: "start" })}
              className="mt-3 w-full rounded bg-green-700 p-3 text-white"
            >
              Start game (empty seats become bots)
            </button>
          ) : (
            <p className="mt-3 text-gray-600">Waiting for the host to start...</p>
          )}
        </>
      )}

      {/* Game screens: one per game */}
      {room.started && room.game === "satte_pe_satta" && (
        <SatteTable room={room} send={send} />
      )}
      {room.started && room.game === "five_three_two" && (
        <FiveThreeTwoTable room={room} send={send} />
      )}
      {room.started && room.game === "asta_chamma" && (
        <AstaTable room={room} send={send} />
      )}
    </div>
  );
}