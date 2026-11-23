// Backend address. On Render we set VITE_API_URL; locally we use localhost.
const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ---------- helpers for a slow server (Render free plan wakes up slowly) ----------

// A fetch that gives up after `ms` milliseconds, instead of waiting forever
function fetchWithTimeout(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Keep trying until the server answers. It may be waking up.
// About 12 attempts, so roughly two minutes at most.
async function fetchUntilAwake(url) {
  let lastError = new Error("Server did not answer");
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {}, 8000);
      if (res.ok) return res;
      lastError = new Error(`Server answered ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw lastError;
}

// ---------- game list (remembered on this device) ----------

const GAMES_KEY = "games_list";

// The last game list we received, shown at once while the fresh one loads
export function cachedGames() {
  try {
    return JSON.parse(localStorage.getItem(GAMES_KEY)) || [];
  } catch {
    return [];
  }
}

// Ask the server for the game list (this also wakes a sleeping server).
// Saves the list so the next visit shows it straight away.
export async function getGames() {
  const res = await fetchUntilAwake(API + "/games/");
  const list = await res.json();
  localStorage.setItem(GAMES_KEY, JSON.stringify(list));
  return list;
}

// ---------- rooms ----------

async function post(path, body) {
  const res = await fetchWithTimeout(
    API + path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    15000
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

export const getRoom = (code) =>
  fetchWithTimeout(API + `/rooms/${code}/`, {}, 15000).then((r) => r.json());

// mode = "single", "team", or "2" / "4" players for Chourail. seat = place in a team room.
export const createRoom = (game, name, solo = false, mode = "single", seat = 0) =>
  post("/rooms/create/", { game, name, solo, mode, seat });

// seat = the place picked in a team room (null = first free place)
export const joinRoom = (code, name, seat = null) => post("/rooms/join/", { code, name, seat });

// Remember who I am in this room (used by the room screen)
export function savePlayer(data) {
  localStorage.setItem("player_" + data.code, data.player_id);
}

// WebSocket address. http becomes ws, https becomes wss.
export function roomSocketUrl(code, playerId) {
  const base = API.replace(/\/api$/, "").replace(/^http/, "ws");
  return `${base}/ws/room/${code}/?player=${playerId}`;
}