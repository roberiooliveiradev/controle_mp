# app/api/routes/test_routes.py

from flask import Blueprint, jsonify, g

from app.api.middlewares.auth_middleware import require_auth, require_roles

bp_test = Blueprint("test", __name__, url_prefix="/test")


@bp_test.get("/protected")
@require_auth
def protected_route():
    
    """
    Rota protegida apenas para teste de autenticação.
    Retorna as claims do token JWT.
    """
    return jsonify(
        {
            "message": "Acesso autorizado",
            "auth_claims": g.auth,
        }
    ), 200


@bp_test.get("/admin-only")
@require_auth
@require_roles(1)  # ajuste o role_id conforme seu banco (ex.: 1 = ADMIN)
def admin_only_route():
    """
    Rota protegida por RBAC (ADMIN).
    """
    return jsonify(
        {
            "message": "Acesso ADMIN autorizado",
            "auth_claims": g.auth,
        }
    ), 200
