BEGIN;

-- tbMessageTypes
INSERT INTO "tbMessageTypes"(id, code, description)
VALUES
    (1, 'TEXT',    'Mensagem normal do usuário'),
    (2, 'REQUEST', 'Mensagem que contém uma solicitação'),
    (3, 'SYSTEM',  'Mensagem automática do sistema')
ON CONFLICT DO NOTHING;

-- tbRequestType
INSERT INTO "tbRequestType" (id, type_name, is_deleted)
VALUES
    (1, 'CREATE', FALSE),
    (2, 'UPDATE', FALSE)
ON CONFLICT (id) DO NOTHING;

-- tbRequestStatus
INSERT INTO "tbRequestStatus" (id, status_name, is_deleted)
VALUES
    (1, 'CREATED', FALSE),
    (2, 'IN_PROGRESS', FALSE),
    (3, 'FINALIZED', FALSE),
    (4, 'FAILED', FALSE),
    (5, 'RETURNED', FALSE),
    (6, 'REJECTED', FALSE)
ON CONFLICT (id) DO NOTHING;


-- tbFieldType
INSERT INTO "tbFieldType" (id, type_name, is_deleted)
VALUES
    (1, 'DEFAULT', FALSE),
    (2, 'OBJECT', FALSE)
ON CONFLICT (id) DO NOTHING;

COMMIT;
