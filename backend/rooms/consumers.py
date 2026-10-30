import asyncio
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer  # pyright: ignore[reportMissingModuleSource]
from channels.layers import get_channel_layer  # pyright: ignore[reportMissingModuleSource]

from core.bot import choose_move

from . import store


async def broadcast(room):
    """Send every player in the room their own fresh view of the game."""
    # Tell the room channel to refresh all connected clients at once.
    await get_channel_layer().group_send(f"room_{room['code']}", {"type": "room_update"})


def is_bot_turn(engine):
    # A bot is active only when the current seat is marked as a bot player.
    return engine.turn is not None and engine.seats[engine.turn].get("bot")


async def drive(room, delay=0):
    """The room's clock. It waits after each play and plays for the bots.
    Only one drive() runs per room at a time (see kick below)."""
    engine = room.get("engine")
    if delay:
        # Optional startup pause so the first bot action happens a moment later.
        await asyncio.sleep(delay)

    while engine:
        if getattr(engine, "hold", False):
            # Let the animation finish, then move the game to the next state.
            await asyncio.sleep(getattr(engine, "hold_for", 1))
            engine.advance()
            await broadcast(room)

        elif not engine.round_over and is_bot_turn(engine):
            # Only bot turns are automated. Humans wait for their own actions.
            phase = getattr(engine, "phase", "play")   # only 5-3-2 has phases
            if phase != "play":
                # Reading time for choose-trump or card-exchange steps.
                await asyncio.sleep(1)

            seat = engine.turn
            if hasattr(engine, "apply_pass") and not engine.legal_moves(seat):
                # Satte pe Satta: if a bot has no legal card, it must pass.
                engine.apply_pass(seat)
            else:
                # Let the bot pick a legal move and apply it immediately.
                engine.apply_move(seat, choose_move(engine, seat))
            await broadcast(room)

            if phase == "trump":
                # Give everyone a quick moment to see the chosen trump.
                await asyncio.sleep(1)

        else:
            # No bot action is needed right now: human turn or round complete.
            break


def kick(room, delay=0):
    """Start the room's clock, unless it is already running."""
    task = room.get("task")
    # Start the clock only when a game exists and no current task is still active.
    if room.get("engine") and (task is None or task.done()):
        room["task"] = asyncio.create_task(drive(room, delay))


class RoomConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.code = self.scope["url_route"]["kwargs"]["code"].upper()
        query = parse_qs(self.scope["query_string"].decode())
        player_id = query.get("player", [""])[0]

        # Only the person who joined this room is allowed to connect here.
        self.room = store.ROOMS.get(self.code)
        self.seat = store.seat_of(self.room, player_id) if self.room else None
        if self.seat is None:
            await self.close()
            return

        # Everyone in the room listens to the same update channel.
        self.group = f"room_{self.code}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await broadcast(self.room)
        kick(self.room, delay=1)   # a bot may need to act as soon as the room opens

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        action = content.get("action")
        room = self.room
        engine = room.get("engine")
        delay = 0   # wait time before bot actions continue after a human move

        if action == "start" and self.seat == 0:
            # Only the host can begin a new match.
            store.start_game(room)
            delay = 1
        elif action == "play" and engine:
            # A player is trying to play a card or choose a trump suit.
            if not engine.apply_move(self.seat, content.get("card")):
                return
        elif action == "pass" and engine and hasattr(engine, "apply_pass"):
            # Some games allow a pass only when the player truly has no valid move.
            if not engine.apply_pass(self.seat):
                return
        elif action == "next_round" and engine and self.seat == 0:
            # Host moves the game to the next round.
            engine.next_round()
            delay = 1
        else:
            return

        await broadcast(room)  # everyone updates at the same time
        kick(room, delay)      # the bot loop handles any follow-up action

    async def room_update(self, event):
        """Runs once per connected player, so each gets their own private view."""
        # Return only this player's state so each client sees their own hand.
        await self.send_json(store.state_for(self.room, self.seat))