import random

from core.base_game import BaseGame
from . import board   # our board settings, from board.py

FINISH = board.FINISH   # the step that means "in the centre"


class AstaGame(BaseGame):
    def __init__(self, seats):
        # The base game stores the seats and the room's player list
        super().__init__(seats)

        # Set every value the screen and the rules read.
        # Doing it here means no value can be missing, even if start() has not run yet.
        self.mode = "single"                         # the room may change this to "team"
        self.steps = [[0] * board.TOKENS_PER_PLAYER for _ in self.seats]
        self.has_cut = [[False] * board.TOKENS_PER_PLAYER for _ in self.seats]  # did this token cut an opponent?        self.skip_next = [False] * len(self.seats)   # team mode: a player must skip a turn
        self.finished_order = []                     # seats in the order they finished
        self.phase = "throw"                         # "throw", then "move", then "throw" again
        self.turn = 0                                # Blue starts
        self.mover = 0                               # who moves a token after the throw
        self.throw_seat = 0                          # who threw
        self.throw_value = 0                         # houses to move
        self.throw_extra = False                     # does this throw give an extra turn?
        self.last_extra = False                      # extra turn from the last move
        self.open_sides = None                       # shells open (None before the first throw)
        self.throw_id = 0                            # counts throws for the rolling animation
        self.hold = False                            # True while a play stays on screen
        self.hold_for = 1.0                          # hold time in seconds
        self.pending = None                          # what to do when the hold ends
        self.round_over = False                      # True when the whole game is over
        self.match_over = False                      # same value, the screen reads this name
        self.winners = []
        self.message = ""
        
    """The rules of Asta Chamma.
    The server decides everything. The screen only shows the board and sends the player's choice."""

    # ---------- small helper functions ----------

    def name(self, seat):
        return self.seats[seat]["name"]

    def is_teammate(self, a, b):
        # Teammates: team mode only, two different seats with the same odd/even number
        return self.mode == "team" and a != b and a % 2 == b % 2

    def tokens_done(self, seat):
        # How many of this player's tokens are in the centre
        return sum(1 for step in self.steps[seat] if step == FINISH)

    def shares(self, seat):
        # Team mode: a player with all 4 tokens home passes their throws to a teammate
        return self.mode == "team" and self.tokens_done(seat) == board.TOKENS_PER_PLAYER

    def finished_single(self, seat):
        # Single mode: a player who finished all 4 tokens does not play any more
        return self.mode == "single" and seat in self.finished_order

    def valid_tokens(self, seat, value):
        """Which tokens can move 'value' houses? Returns token numbers (0 to 3)."""
        result = []
        listed_start = False
        for t, step in enumerate(self.steps[seat]):
            if step == FINISH:
                continue                       # already in the centre

            if step == 0:
                if listed_start:
                    continue                   # all start-area tokens are the same, list one
                listed_start = True

            new_step = step + value
            if new_step > FINISH:
                continue                       # never go past the centre

            # On a plain OUTER box, you cannot land where your own token already stands.
            # Home houses are safe and can hold any number of tokens, so they are allowed.
            if new_step < board.INNER_START:
                cell = board.cell_of(seat, new_step)
                if cell not in board.SAFE_CELLS:
                    own_here = [s for s, _ in self.tokens_on(cell, exclude=(seat, t)) if s == seat]
                    if own_here:
                        continue

            # A token may go from the outer ring into the inner ring only after it has cut
            entering_inner = step < board.INNER_START <= new_step
            if entering_inner and not self.has_cut[seat][t]:
                continue

            result.append(t)
        return result
    
    def tokens_on(self, cell, exclude=None):
        """Every token standing on this house, as (seat, token) pairs.
        'exclude' is one token to leave out, such as the token that is moving."""
        found = []
        for s in range(len(self.seats)):
            for t, step in enumerate(self.steps[s]):
                if (s, t) == exclude:
                    continue                   # skip the token we were told to ignore
                if 0 < step < FINISH and board.cell_of(s, step) == cell:
                    found.append((s, t))
        return found



    def opponents_on(self, seat, cell):
        """Enemy tokens standing on this house. Returns (other_seat, token_no) pairs."""
        found = []
        for other in range(len(self.seats)):
            if other == seat or self.is_teammate(seat, other):
                continue                       # skip myself and my teammates
            for t, step in enumerate(self.steps[other]):
                if 0 < step < FINISH and board.cell_of(other, step) == cell:
                    found.append((other, t))
        return found

    def position(self, seat, t):
        """Where one token is, for the screen: "start", "finish", or [row, column]."""
        step = self.steps[seat][t]
        if step == 0:
            return "start"
        if step == FINISH:
            return "finish"
        return list(board.cell_of(seat, step))

    # ---------- setting up ----------

    def start(self):
        # The room sets self.mode ("single" or "team") before start() runs
        self.mode = getattr(self, "mode", "single")
        self.steps = [[0] * board.TOKENS_PER_PLAYER for _ in self.seats]  # step of each token
        self.has_cut = [[False] * board.TOKENS_PER_PLAYER for _ in self.seats]  # did this token cut an opponent?
        self.skip_next = [False] * len(self.seats)   # team mode: this player must skip a turn
        self.finished_order = []                     # seats in the order they finished
        self.phase = "throw"                         # "throw", then "move", then "throw" again
        self.turn = 0                                # Blue (seat 0) starts
        self.mover = 0                               # who moves a token after the throw
        self.throw_seat = 0                          # who threw
        self.throw_value = 0                         # houses to move: 8, 4, 1, 2 or 3
        self.throw_extra = False                     # does this throw give an extra turn?
        self.last_extra = False                      # extra turn from the last move (cut, 4 or 8)
        self.open_sides = None                       # shells showing open side (for the picture)
        self.throw_id = 0                            # counts every throw, so the screen knows when to roll
        self.hold_for = 1.0                          # how long the hold lasts (seconds)
        self.pending = None                          # what to do when the hold ends
        self.round_over = False                      # True when the whole game is over
        self.match_over = False                      # same as round_over (screen uses this name)
        self.winners = []
        self.message = f"{self.name(0)} starts. Throw the cowries."

    def next_round(self):
        # Asta Chamma is one game, not several rounds, so nothing to do here
        pass

    # ---------- what a player may do ----------

    def legal_moves(self, seat):
        if self.hold or self.match_over:
            return []                          # nobody acts during the 1 second hold
        if self.phase == "throw" and seat == self.turn:
            return ["throw"]                   # on my turn, the only move is to throw
        if self.phase == "move" and seat == self.mover:
            # the mover chooses a token that can move
            return [str(t) for t in self.valid_tokens(seat, self.throw_value)]
        return []

    def apply_move(self, seat, move):
        if move not in self.legal_moves(seat):
            return False                       # wrong turn, wrong move, or during the hold
        if move == "throw":
            self.do_throw(seat)
        else:
            self.do_move(seat, int(move))
        return True

    # ---------- throwing ----------

    def do_throw(self, seat):
        self.throw_id += 1                           # a new throw happened
        keys = list(board.THROWS.keys())
        value = random.choices(keys, weights=list(board.THROWS.values()))[0]
        self.throw_value = int(value)
        self.throw_extra = value in board.EXTRA_TURN
        self.open_sides = board.OPEN_SIDES[value]
        self.throw_seat = seat

        # 2. Who moves the token? Normally the thrower.
        #    In team mode, a player who finished passes the move to their teammate.
        self.mover = (seat + 2) % 4 if self.shares(seat) else seat

        # 3. Show the throw first (hold), then the mover picks a token
        self.phase = "move"
        self.turn = self.mover
        extra_text = " (extra turn)" if self.throw_extra else ""
        share_text = f", moved by {self.name(self.mover)}" if self.mover != seat else ""
        self.message = (f"{self.name(seat)} threw {self.open_sides} open: "
                        f"{value} houses{extra_text}{share_text}")
        self.hold = True
        self.hold_for = 1.0
        self.pending = "after_throw"

    # ---------- moving a token ----------

    def do_move(self, seat, token):
        # seat = the player who moves (the mover), token = which token (0 to 3)
        self.steps[seat][token] += self.throw_value
        new_step = self.steps[seat][token]
        extra = self.throw_extra
        self.cut_distance = 0                  # how many houses a cut token must slide back
        text = f"{self.name(seat)} moved token {token + 1} by {self.throw_value}"

        if new_step == FINISH:
            # Reaching the centre gives one more throw
            extra = True
            text += " and reached the centre (one more throw!)"
            if self.tokens_done(seat) == board.TOKENS_PER_PLAYER:
                text += f". {self.name(seat)} has all 4 tokens home!"
                self.player_finished(seat)
        else:
            cut = self.cut_at(seat, new_step, token)
            if cut:
                extra = True                   # a cut gives an extra turn
                self.has_cut[seat][token] = True   # this token may now go inside
                text += " and CUT " + ", ".join(cut)

        self.message = text
        self.last_extra = extra
        self.hold = True
        # Wait for the moving token to slide, plus the cut token's slide back home
        self.hold_for = 1.0 + 0.2 * self.throw_value + 0.18 * self.cut_distance
        self.pending = "after_move"

    def cut_at(self, seat, step, token):
        """Cut every opponent token on this house.
        Only the home houses are safe. Every other box can be cut."""
        cell = board.cell_of(seat, step)
        if cell in board.SAFE_CELLS:
            return []                          # home house: nothing can be cut

        names = []
        for other, t in self.tokens_on(cell, exclude=(seat, token)):
            if other == seat or self.is_teammate(seat, other):
                continue                       # only opponents are cut
            self.cut_distance = max(self.cut_distance, self.steps[other][t])
            self.steps[other][t] = 0           # back to its own home
            names.append(f"{self.name(other)}'s token {t + 1}")
        return names
            
    def player_finished(self, seat):
        self.finished_order.append(seat)
        if self.mode == "team":
            # Team mode: the finished player skips one turn, then shares their throws
            self.skip_next[seat] = True

    # ---------- what happens after the 1 second hold ----------

    def advance(self):
        """Called when the 1 second hold is over. Moves the game on to the next step."""
        if not self.hold:
            return
        self.hold = False
        step, self.pending = self.pending, None

        if step == "after_throw":
            # If no token can move with this throw, the turn ends here
            if not self.valid_tokens(self.mover, self.throw_value):
                self.message += ". No token can move"
                self.finish_action(self.throw_extra)
            # Otherwise the mover now chooses a token

        elif step == "after_move":
            self.finish_action(self.last_extra)

    def finish_action(self, extra):
        """One throw and one move are done. Same player again, or the next player?"""
        if self.check_game_over():
            return
        if extra and not self.finished_single(self.throw_seat):
            # Extra turn: the same player throws again
            self.phase = "throw"
            self.turn = self.throw_seat
            self.message += f". {self.name(self.turn)} throws again"
        else:
            self.next_turn()

    def next_turn(self):
        """Give the turn to the next player, going ANTICLOCKWISE on the board.
        Anticlockwise means the seat number goes DOWN: 0 → 3 → 2 → 1 → 0.
        Skips finished players (single mode) and the skipped turn (team mode)."""
        self.phase = "throw"
        seat = self.turn
        skipped = []
        for _ in range(len(self.seats) * 2):   # look at most two laps around the table
            seat = (seat - 1) % len(self.seats)  # -1 = anticlockwise
            if self.finished_single(seat):
                continue                       # single mode: finished players sit out
            if self.skip_next[seat]:
                self.skip_next[seat] = False   # this skipped turn is now used up
                skipped.append(self.name(seat))
                continue
            break
        self.turn = seat
        note = f"{' and '.join(skipped)} skipped a turn. " if skipped else ""
        self.message = f"{note}{self.name(seat)}'s turn: throw the cowries"

    # ---------- end of game ----------

    def check_game_over(self):
        done = False
        if self.mode == "single":
            # Single mode: the game ends when all 4 players are finished
            if len(self.finished_order) == len(self.seats):
                self.winners = [self.finished_order[0]]
                done = True
        else:
            # Team mode: the first team with all 8 tokens home wins
            for team in board.TEAMS:
                if sum(self.tokens_done(s) for s in team) == board.TOKENS_PER_PLAYER * len(team):
                    self.winners = team
                    done = True
        if done:
            self.round_over = True
            self.match_over = True
            if self.mode == "single":
                self.message = f"Game over! {self.name(self.winners[0])} wins first place."
            else:
                self.message = "Game over! " + " and ".join(self.name(s) for s in self.winners) + " win."
        return done

    # ---------- the bots ----------

    def bot_move(self, seat):
        """A simple bot. It throws when it can. For a token, it picks in this order:
        1. a cut on an opponent, 2. the centre, 3. any token."""
        if self.phase == "throw":
            return "throw"
        tokens = self.valid_tokens(seat, self.throw_value)
        for t in tokens:                       # 1. a cut on an opponent
            new_step = self.steps[seat][t] + self.throw_value
            if new_step < FINISH:
                cell = board.cell_of(seat, new_step)
                if cell not in board.SAFE_CELLS and any(
                    s != seat and not self.is_teammate(seat, s)
                    for s, _ in self.tokens_on(cell, exclude=(seat, t))
                ):
                    return str(t)
        for t in tokens:                       # 2. reach the centre
            if self.steps[seat][t] + self.throw_value == FINISH:
                return str(t)
        return str(random.choice(tokens))      # 3. any token
    
    # ---------- what each player's screen gets ----------

    def state_for(self, seat):
        """Asta Chamma has no hidden cards, so everyone sees the whole board."""
        return {
            "mode": self.mode,
            "colors": [p["color"] for p in board.PLAYERS],
            "homes": [list(h) for h in board.HOMES],
            "positions": [
                [self.position(s, t) for t in range(board.TOKENS_PER_PLAYER)]
                for s in range(len(self.seats))
            ],
            "steps": self.steps,
            # every player's path, house by house, so the screen can slide tokens along it
            "tracks": [[list(cell) for cell in track] for track in board.TRACKS],
            "done": [self.tokens_done(s) for s in range(len(self.seats))],
            "skip": self.skip_next,
            "phase": self.phase,
            "turn": self.turn,
            "mover": self.mover,
            "my_moves": self.legal_moves(seat),
            "throw_value": self.throw_value,
            "open_sides": self.open_sides,
            "throw_id": self.throw_id,
            "throw_extra": self.throw_extra,
            "ranking": self.finished_order,
            "round_over": self.round_over,
            "match_over": self.match_over,
            "winners": self.winners,
            "message": self.message,
        }