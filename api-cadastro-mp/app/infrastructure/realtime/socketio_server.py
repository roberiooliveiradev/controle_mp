# app/infrastructure/realtime/socketio_server.py
from __future__ import annotations

from flask_socketio import SocketIO

socketio = SocketIO(
    cors_allowed_origins=[
        # DEV local
        "http://localhost:5173",
        "http://127.0.0.1:5173",

        # LAN (produção interna)
        "http://192.168.1.237",

        # opcional: algumas máquinas acessam por hostname local
        "http://srv-api",
        "http://srv-api.local",
    ],
    async_mode="eventlet",
)
