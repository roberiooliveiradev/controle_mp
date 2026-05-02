# app/infrastructure/realtime/socketio_server.py
from __future__ import annotations

import os

from flask_socketio import SocketIO


def _get_socketio_cors_origins() -> list[str]:
    raw_origins = os.getenv("SOCKETIO_CORS_ORIGINS", "").strip()

    if raw_origins:
        return [
            origin.strip()
            for origin in raw_origins.split(",")
            if origin.strip()
        ]

    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8088",
        "http://127.0.0.1:8088",
        "http://192.168.1.237",
        "http://srv-api",
        "http://srv-api.local",
        "https://controle-mp.minhadelpi.com.br",
    ]


socketio = SocketIO(
    cors_allowed_origins=_get_socketio_cors_origins(),
    async_mode="eventlet",
)