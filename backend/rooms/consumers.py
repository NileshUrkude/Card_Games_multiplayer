import asyncio
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer  # type: ignore[import-not-found]
from channels.layers import get_channel_layer  # type: ignore[import-not-found]

from core.bot import choose_move

from . import store


async def broadcast(room):
    """Send every player in the room their own fresh view of the game."""
    await get_channel_layer().group_send(f"room_{room['code']}", {"type": "room_update"})


def is_bot_turn(engine):
    return engine.turn is not None and engine.seats[engine.turn].get("bot")


async def drive(room, delay=0):
    """The room's clock. It waits after each step, plays for the bots,
    and runs the 1-minute discard timer in Rummy. Only one clock runs per room."""
    engine = room.get("engine")
    if delay:
        await asyncio.sleep(delay)

    while engine:
        if getattr(engine, "hold", False):
            # A card was just played: keep it on screen, then move on
            await asyncio.sleep(getattr(engine, "hold_for", 1))
            engine.advance()
            await broadcast(room)

        elif not engine.round_over and is_bot_turn(engine):
            phase = getattr(engine, "phase", "play")
            if phase != "play":
                await asyncio.sleep(1)   # a short pause so you can see what happens

            seat = engine.turn
            if hasattr(engine, "apply_pass") and not engine.legal_moves(seat):
                engine.apply_pass(seat)
            else:
                engine.apply_move(seat, choose_move(engine, seat))
            await broadcast(room)

            if phase == "trump":
                await asyncio.sleep(1)

        elif getattr(engine, "deadline", None) is not None and not engine.round_over:
            # A human has drawn and must discard: count down, once a second
            await asyncio.sleep(1)
            engine.tick()
            await broadcast(room)

        else:
            break   # nothing to do: a human's turn, or the round is over


def kick(room, delay=0):
    """Start the room's clock, unless it is already running."""
    task = room.get("task")
    if room.get("engine") and (task is None or task.done()):
        room["task"] = asyncio.create_task(drive(room, delay))


class RoomConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.code = self.scope["url_route"]["kwargs"]["code"].upper()
        query = parse_qs(self.scope["query_string"].decode())
        player_id = query.get("player", [""])[0]

        # Only players who joined this room may connect
        self.room = store.ROOMS.get(self.code)
        self.seat = store.seat_of(self.room, player_id) if self.room else None
        if self.seat is None:
            await self.close()
            return

        # Everyone in the room listens to the same "group"
        self.group = f"room_{self.code}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await broadcast(self.room)
        kick(self.room, delay=1)   # a bot may have the first turn (solo game)

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content):
        action = content.get("action")
        room = self.room
        engine = room.get("engine")
        delay = 0

        if action == "start" and self.seat == 0:      # host starts the game
            store.start_game(room)
            delay = 1
        elif action == "play" and engine:             # a card, a choice, or a Rummy action
            if not engine.apply_move(self.seat, content.get("card")):
                return
        elif action == "pass" and engine and hasattr(engine, "apply_pass"):
            if not engine.apply_pass(self.seat):      # only allowed with no valid card
                return
        elif action == "next_round" and engine and self.seat == 0:
            engine.next_round()
            delay = 1
        else:
            return

        await broadcast(room)        # everyone sees the change at once
        kick(room, delay)            # the clock handles the waiting, the bots and the timer

    async def room_update(self, event):
        """Runs once per connected player, so each gets their own private view."""
        await self.send_json(store.state_for(self.room, self.seat))