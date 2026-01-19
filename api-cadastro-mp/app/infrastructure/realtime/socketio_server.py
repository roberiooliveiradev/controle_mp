# app/infrastructure/realtime/socketio_server.py
from __future__ import annotations

from flask_socketio import SocketIO

socketio = SocketIO(
    cors_allowed_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    async_mode="threading",  # evita dor de cabeça com eventlet no Windows
    logger=False,
    engineio_logger=False,
)
