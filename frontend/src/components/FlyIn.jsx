import { useEffect, useState } from "react";

// children start away from their final place (at the player's side) and
// slide in. `from` is [x, y] in pixels, e.g. FLY["left"].
export default function FlyIn({ from, children }) {
  const [landed, setLanded] = useState(false);

  // A moment after the first draw, let the card move to its place
  useEffect(() => {
    const id = setTimeout(() => setLanded(true), 30);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className="relative transition-all duration-500 ease-out"
      style={{
        opacity: landed ? 1 : 0,
        transform: landed ? "none" : `translate(${from[0]}px, ${from[1]}px)`,
        zIndex: landed ? 1 : 50, // flying card passes over other cards
      }}
    >
      {children}
    </div>
  );
}