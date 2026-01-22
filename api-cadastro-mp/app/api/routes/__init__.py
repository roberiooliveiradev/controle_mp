from flask import Flask

from app.api.routes.health_routes import bp_health
from app.api.routes.user_routes import bp_users
from app.api.routes.auth_routes import bp_auth
from app.api.routes.conversation_routes import bp_conv
from app.api.routes.message_routes import bp_msg
from app.api.routes.test_routes import bp_test
from app.api.routes.request_routes import bp_req
from app.api.routes.product_routes import bp_prod

def register_routes(app: Flask) -> None:
    app.register_blueprint(bp_health) # /health
    app.register_blueprint(bp_users, url_prefix="/api/users") 
    app.register_blueprint(bp_auth, url_prefix="/api/auth")
    app.register_blueprint(bp_conv, url_prefix="/api/conversations")
    app.register_blueprint(bp_msg, url_prefix="/api/conversations/<int:conversation_id>/messages")
    app.register_blueprint(bp_test)
    app.register_blueprint(bp_req)
    app.register_blueprint(bp_prod)