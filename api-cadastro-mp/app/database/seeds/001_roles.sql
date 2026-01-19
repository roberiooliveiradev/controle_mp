BEGIN;

INSERT INTO "tbRoles" (role_name, permissions)
VALUES
    ('ADMIN', 'ALL'),
    ('ANALYST', 'READ,WRITE'),
    ('USER', 'READ')
ON CONFLICT (role_name) DO NOTHING;

COMMIT;
