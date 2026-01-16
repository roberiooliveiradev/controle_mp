from flask import Blueprint, jsonify
from sqlalchemy import text

from app.infrastructure.database.session import db_session

bp_health = Blueprint("health", __name__, url_prefix="/health")


@bp_health.get("")
def health():
    return jsonify({"status": "ok"}), 200


@bp_health.get("/db")
def health_db():
    with db_session() as session:
        session.execute(text("select 1"))
    return jsonify({"db": "ok"}), 200
