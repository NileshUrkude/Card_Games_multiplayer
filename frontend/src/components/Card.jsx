// One playing card. Shows number + suit, or the back when back={true}.
const SIZES = {
  xs: "h-10 w-7 text-[10px]",
  sm: "h-14 w-10 text-xs",
  md: "h-16 w-11 text-sm",
  lg: "h-24 w-16 text-lg",
};
// Sideways cards (left and right opponents): width and height swapped
const SIDE_SIZES = { xs: "h-7 w-10", sm: "h-10 w-14" };

export default function Card({
  code = "", back = false, size = "md",
  sideways = false,  // turn the card sideways
  inline = false,    // show "8♥" in one line in the corner (for overlapped cards)
  fill = false,      // card fills the width of its box (used in the hand)
  playable = false,
  dim = false,       // card cannot be played now: solid grey (never see-through)
  onClick, style,
}) {
  const dims = fill
    ? "w-full aspect-[5/7] text-[11px] sm:text-sm"
    : sideways ? SIDE_SIZES[size] : SIZES[size];
  const base = `${dims} relative shrink-0 select-none rounded-md border shadow `;

  // Face-down card: blue stripes
  if (back) {
    return (
      <div
        style={{
          ...style,
          backgroundImage:
            "repeating-linear-gradient(45deg,#1e40af,#1e40af 4px,#3b82f6 4px,#3b82f6 8px)",
        }}
        className={base + "border-white"}
      />
    );
  }

  const rank = code.slice(0, -1); // "10♥" → "10"
  const suit = code.slice(-1);    // "10♥" → "♥"
  const red = suit === "♥" || suit === "♦";
  const Tag = onClick ? "button" : "div"; // only playable cards are buttons

  const colors =
    (dim ? "bg-gray-200 " : "bg-white ") + (red ? "text-red-600 " : "text-black ");

  return (
    <Tag
      onClick={onClick}
      style={style}
      className={
        base + "font-bold " + colors +
        (playable ? "-translate-y-2 border-2 border-green-500 " : "border-gray-400 ")
      }
    >
      {inline ? (
        <span className="absolute left-1 top-0.5 leading-none">{rank}{suit}</span>
      ) : (
        <>
          {/* number and suit in the top-left corner */}
          <span className="absolute left-1 top-0.5 flex flex-col items-center leading-none">
            <span>{rank}</span>
            <span>{suit}</span>
          </span>
          {/* big suit in the middle (not on the small cards) */}
          {size !== "xs" && !fill && (
            <span className="absolute inset-0 flex items-center justify-center text-2xl opacity-80">
              {suit}
            </span>
          )}
        </>
      )}
    </Tag>
  );
}