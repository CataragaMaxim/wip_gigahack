"""Run the bot locally using long polling."""

from bot.app import app


if __name__ == "__main__":
    app.run_polling()
