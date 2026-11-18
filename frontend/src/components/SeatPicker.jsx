// Two teams and their places:
//   Team 1 = Player 1 (place 0) + Player 3 (place 2)
//   Team 2 = Player 2 (place 1) + Player 4 (place 3)
const PLAYER_NUMBER = ["Player 1", "Player 2", "Player 3", "Player 4"];

const TEAMS = [
  { title: "Team 1", places: [0, 2] },
  { title: "Team 2", places: [1, 3] },
];

// names    = the name in each place (null = free)
// selected = the place the player picked (null = none yet)
// onSelect = called with the place number when a free place is tapped
export default function SeatPicker({ names, selected, onSelect }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      {TEAMS.map((team) => (
        <div key={team.title} className="rounded-xl border p-2">
          <p className="mb-2 text-center text-sm font-bold">{team.title}</p>

          {team.places.map((place) => {
            const taken = names[place] !== null && names[place] !== undefined;
            const mine = selected === place;
            return (
              <button
                key={place}
                type="button"
                disabled={taken}
                onClick={() => onSelect(place)}
                className={
                  "mb-2 w-full rounded p-2 text-left text-sm " +
                  (taken
                    ? "bg-gray-200 text-gray-500"
                    : mine
                    ? "bg-green-600 text-white"
                    : "border bg-white")
                }
              >
                <span className="block text-[10px] opacity-70">{PLAYER_NUMBER[place]}</span>
                {taken ? names[place] : mine ? "Your place" : "Free: tap to pick"}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}