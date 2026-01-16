# app/api/middlewares/error_handler.py
import traceback
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

from app.core.exceptions import AppError
from app.config.settings import settings


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(AppError)
    def handle_app_error(err: AppError):
        return jsonify({"error": str(err)}), err.status_code

    @app.errorhandler(HTTPException)
    def handle_http_exception(err: HTTPException):
        return jsonify({"error": err.description}), err.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(err: Exception):
        traceback.print_exc()  # ✅ imprime o stack trace no terminal

        if settings.debug:
            return jsonify({"error": str(err)}), 500  # ✅ mostra a msg em dev

        return jsonify({"error": "Internal server error"}), 500
