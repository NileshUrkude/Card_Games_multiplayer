// Backend address. On Render we set VITE_API_URL; locally we use localhost.
const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function post(path, body) {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const getGames = () => fetch(API + "/games/").then((r) => r.json());
export const getRoom = (code) => fetch(API + `/rooms/${code}/`).then((r) => r.json());

export const createRoom = (game, name, solo = false) =>
  post("/rooms/create/", { game, name, solo });

export function savePlayer(data) {
  localStorage.setItem("player_" + data.code, data.player_id);
}

export const joinRoom = (code, name) => post("/rooms/join/", { code, name });

// WebSocket address. http becomes ws, https becomes wss.
export function roomSocketUrl(code, playerId) {
  const base = API.replace(/\/api$/, "").replace(/^http/, "ws");
  return `${base}/ws/room/${code}/?player=${playerId}`;
}