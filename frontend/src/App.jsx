import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import GameMenu from "./pages/GameMenu";
import Friends from "./pages/Friends";
import Lobby from "./pages/Lobby";

export default function App() {
  return (
    <Routes>
      {/* Every page sits inside Layout (header + profile corner) */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/game/:gameId" element={<GameMenu />} />
        <Route path="/game/:gameId/friends" element={<Friends />} />
        <Route path="/room/:code" element={<Lobby />} />
      </Route>
    </Routes>
  );
}