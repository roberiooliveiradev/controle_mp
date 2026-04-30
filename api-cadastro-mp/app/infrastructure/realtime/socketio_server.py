# app/infrastructure/realtime/socketio_server.py
from __future__ import annotations

from flask_socketio import SocketIO

socketio = SocketIO(
    cors_allowed_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://192.168.1.237",
        "http://srv-api",
        "http://srv-api.local",
        "https://controle-mp.minhadelpi.com.br",
    ],
    async_mode="eventlet",
)