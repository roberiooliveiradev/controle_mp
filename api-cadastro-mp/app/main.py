# app/main.py
from __future__ import annotations

import os
import eventlet

# ✅ PRECISA ser o primeiro comando do arquivo
eventlet.monkey_patch()

from flask import Flask  # noqa: E402
from flask_cors import CORS  # noqa: E402

from app.api.realtime.socket_handlers import register_socket_handlers  # noqa: E402
from app.infrastructure.realtime.socketio_server import socketio  # noqa: E402
from app.config.flask_config import configure_app  # noqa: E402
from app.config.settings import settings  # noqa: E402
from app.api.routes import register_routes  # noqa: E402
from app.api.middlewares.error_handler import register_error_handlers  # noqa: E402

import app.infrastructure.database.models  # noqa: F401, E402


# -------------------------
# Prefixos (subpath)
# -------------------------
RAW_APP_PREFIX = os.getenv("APP_PREFIX", "").strip().rstrip("/")

APP_PREFIX = RAW_APP_PREFIX if RAW_APP_PREFIX and RAW_APP_PREFIX != "/" else ""
API_PREFIX = f"{APP_PREFIX}/api"
SOCKET_PREFIX = f"{APP_PREFIX}/socket.io"


def _get_cors_origins() -> list[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "").strip()

    if raw_origins:
        return [
            origin.strip()
            for origin in raw_origins.split(",")
            if origin.strip()
        ]

    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://controle-mp.minhadelpi.com.br",
    ]


def create_app() -> Flask:
    app = Flask(__name__)

    CORS(
        app,
        resources={
            rf"{API_PREFIX}/*": {
                "origins": _get_cors_origins(),
            }
        },
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    configure_app(app)

    register_routes(app, api_prefix=API_PREFIX, app_prefix=APP_PREFIX)

    register_error_handlers(app)

    socketio.init_app(app, path=SOCKET_PREFIX)
    register_socket_handlers()

    return app


app = create_app()

if __name__ == "__main__":
    # OBS: em produção usamos gunicorn.
    # Este bloco é apenas para execução direta/local.
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("API_CONTAINER_PORT", "5000")),
        debug=settings.debug,
    )