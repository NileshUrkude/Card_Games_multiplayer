import random


def choose_move(game, seat):
    """Bot picks a move. A game can give its own smarter bot_move()."""
    if hasattr(game, "bot_move"):
        return game.bot_move(seat)
    return random.choice(game.legal_moves(seat))