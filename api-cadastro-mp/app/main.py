from flask import Flask

from app.api.middlewares.error_handler import register_error_handlers
from app.api.routes import register_routes
from app.config.flask_config import configure_app
import app.infrastructure.database.models  # noqa: F401

def create_app() -> Flask:
    app = Flask(__name__)
    configure_app(app)
    register_routes(app)
    register_error_handlers(app)
    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
