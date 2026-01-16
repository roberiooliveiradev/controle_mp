import base64
import hashlib
import hmac
import os


class PasswordHasher:
    DEFAULT_ALGO = "pbkdf2_sha256"
    DEFAULT_ITERATIONS = 600_000
    SALT_BYTES = 16

    @classmethod
    def hash_password(
        cls, password: str, *, iterations: int | None = None
    ) -> tuple[str, str, str, int]:
        if not password or len(password) < 8:
            raise ValueError("Senha inválida (mín. 8 caracteres).")

        it = iterations or cls.DEFAULT_ITERATIONS
        salt = os.urandom(cls.SALT_BYTES)

        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            it,
        )

        password_hash = base64.b64encode(dk).decode("utf-8")
        password_salt = base64.b64encode(salt).decode("utf-8")
        return (password_hash, password_salt, cls.DEFAULT_ALGO, it)

    @classmethod
    def verify_password(
        cls,
        password: str,
        *,
        password_hash: str,
        password_salt: str,
        iterations: int,
        algo: str,
    ) -> bool:
        if algo not in (cls.DEFAULT_ALGO, "pbkdf2"):
            # compat simples com seu default atual
            return False

        try:
            salt = base64.b64decode(password_salt.encode("utf-8"))
            expected = base64.b64decode(password_hash.encode("utf-8"))
        except Exception:
            return False

        dk = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(dk, expected)
