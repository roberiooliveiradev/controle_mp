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
    (1, 'CRIAR', FALSE),
    (2, 'ALTERAR', FALSE)
ON CONFLICT (id) DO NOTHING;

-- tbRequestStatus
INSERT INTO "tbRequestStatus" (id, status_name, is_deleted)
VALUES
    (1, 'CRIADO', FALSE),
    (2, 'EM PROCESSO', FALSE),
    (3, 'FINALIZADO', FALSE),
    (4, 'FRACASSADO', FALSE),
    (5, 'DEVOLVIDO', FALSE),
    (6, 'REJEITADO', FALSE)
ON CONFLICT (id) DO NOTHING;


-- tbFieldType
INSERT INTO "tbFieldType" (id, type_name, is_deleted)
VALUES
    (1, 'DEFAULT', FALSE),
    (2, 'OBJECT', FALSE)
ON CONFLICT (id) DO NOTHING;

COMMIT;
