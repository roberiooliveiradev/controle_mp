# app/main.py
from flask import Flask
from flask_cors import CORS

from app.api.middlewares.error_handler import register_error_handlers
from app.api.routes import register_routes
from app.config.flask_config import configure_app
from app.infrastructure.realtime.socketio_server import socketio
from app.api.realtime.socket_handlers import register_socket_handlers

import app.infrastructure.database.models  # noqa: F401

def create_app() -> Flask:
    app = Flask(__name__)
    configure_app(app)
    register_routes(app)
    register_error_handlers(app)

    # SocketIO
    socketio.init_app(app)
    register_socket_handlers()

    return app


app = create_app()

# CORS HTTP (rotas /api/*)
CORS(
    app,
    resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

if __name__ == "__main__":
    # Rodar via SocketIO (habilita websocket)
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
