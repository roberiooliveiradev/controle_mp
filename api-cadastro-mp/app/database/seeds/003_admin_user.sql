BEGIN;

INSERT INTO "tbUsers" (
    full_name,
    email,
    password_algo,
    password_iterations,
    password_hash,
    password_salt,
    role_id
)
SELECT
    'Administrador do Sistema',
    'admin@controlemp.local',
    'pbkdf2_sha256',
    260000,
    'HASH_EXEMPLO',
    'SALT_EXEMPLO',
    r.id
FROM "tbRoles" r
WHERE r.role_name = 'ADMIN'
ON CONFLICT (email) DO NOTHING;

COMMIT;
