"""Run the bot locally using long polling."""

from bot.app import build_app


if __name__ == "__main__":
    build_app().run_polling()
