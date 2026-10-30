import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { roomSocketUrl } from "../api";
import FiveThreeTwoTable from "../games/five_three_two/FiveThreeTwoTable";
import SatteTable from "../games/satte_pe_satta/SatteTable";

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

  if (lost) return <p className="p-6 text-red-600">Disconnected. Go back and join again.</p>;
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
    </div>
  );
}