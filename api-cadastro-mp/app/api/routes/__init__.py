# app/api/routes/__init__.py

from flask import Flask

from app.api.routes.health_routes import bp_health
from app.api.routes.user_routes import bp_users
from app.api.routes.auth_routes import bp_auth
from app.api.routes.conversation_routes import bp_conv
from app.api.routes.message_routes import bp_msg
from app.api.routes.file_routes import bp_files
from app.api.routes.test_routes import bp_test
from app.api.routes.request_routes import bp_req
from app.api.routes.product_routes import bp_prod
from app.api.routes.audit_routes import bp_audit


def register_routes(app: Flask, *, api_prefix: str, app_prefix: str) -> None:
    # health fora de /api (mas dentro do app)
    app.register_blueprint(bp_health, url_prefix=f"{app_prefix}/health")

    # tudo de API padronizado
    app.register_blueprint(bp_users, url_prefix=f"{api_prefix}/users")
    app.register_blueprint(bp_auth, url_prefix=f"{api_prefix}/auth")
    app.register_blueprint(bp_conv, url_prefix=f"{api_prefix}/conversations")

    app.register_blueprint(
        bp_msg, url_prefix=f"{api_prefix}/conversations/<int:conversation_id>/messages"
    )

    app.register_blueprint(bp_files, url_prefix=f"{api_prefix}/files")
    app.register_blueprint(bp_req, url_prefix=f"{api_prefix}/requests")
    app.register_blueprint(bp_prod, url_prefix=f"{api_prefix}/products")
    app.register_blueprint(bp_audit, url_prefix=f"{api_prefix}/audit")

    # rotas de teste (se quiser dentro do app)
    app.register_blueprint(bp_test, url_prefix=f"{app_prefix}/test")