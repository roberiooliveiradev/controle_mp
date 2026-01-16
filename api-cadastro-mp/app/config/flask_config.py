from flask import Flask

from app.config.settings import settings


def configure_app(app: Flask) -> None:
    app.config["ENV"] = settings.environment
    app.config["DEBUG"] = settings.debug
