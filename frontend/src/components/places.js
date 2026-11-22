// Turn a list of numbers into places. Ties share a place.
// lowerIsBetter = true when the smallest number is the best (Satte pe Satta).
export function placesFrom(values, lowerIsBetter = false) {
  return values.map((v) => 1 + values.filter((o) => (lowerIsBetter ? o < v : o > v)).length);
}

// Place number to text: 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th"
export function placeText(p) {
  return ["", "1st", "2nd", "3rd"][p] || `${p}th`;
}