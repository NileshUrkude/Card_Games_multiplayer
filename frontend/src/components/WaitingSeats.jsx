// The waiting list in the lobby.
// Team rooms: grouped as Team 1 (Player 1 + 3) and Team 2 (Player 2 + 4).
// Other rooms: a simple list of seats.
export default function WaitingSeats({ room }) {
  if (!room.teams) {
    return (
      <>
        {room.seats.map((name, i) => (
          <div key={i} className="mb-2 rounded border p-3">
            Seat {i + 1}: {name || <span className="text-gray-400">waiting...</span>}
            {i === room.my_seat && " (you)"}
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {[
        { title: "Team 1", places: [0, 2] },
        { title: "Team 2", places: [1, 3] },
      ].map((team) => (
        <div key={team.title} className="mb-3 rounded border p-2">
          <p className="mb-2 font-bold">{team.title}</p>
          {team.places.map((i) => (
            <div key={i} className="mb-1 rounded bg-gray-50 p-2 text-sm">
              Player {i + 1}: {room.seats[i] || <span className="text-gray-400">free</span>}
              {i === room.my_seat && " (you)"}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}