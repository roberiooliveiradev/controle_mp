# app/main.py
from __future__ import annotations

import eventlet

# ✅ PRECISA ser o primeiro comando do arquivo
eventlet.monkey_patch()

from flask import Flask  # noqa: E402
from flask_cors import CORS  # noqa: E402

from app.api.realtime.socket_handlers import register_socket_handlers  # noqa: E402
from app.infrastructure.realtime.socketio_server import socketio  # noqa: E402
from app.config.flask_config import configure_app  # noqa: E402
from app.api.routes import register_routes  # noqa: E402
from app.api.middlewares.error_handler import register_error_handlers  # noqa: E402

import app.infrastructure.database.models  # noqa: F401, E402


def create_app() -> Flask:
    app = Flask(__name__)

    # ✅ CORS aplicado cedo (antes das rotas lidarem com OPTIONS)
    CORS(
        app,
        resources={
            r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    configure_app(app)
    register_routes(app)
    register_error_handlers(app)

    socketio.init_app(app)
    register_socket_handlers()

    return app


app = create_app()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
