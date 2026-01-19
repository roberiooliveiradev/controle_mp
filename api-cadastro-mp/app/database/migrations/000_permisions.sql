-- trocar user_name pelo nome do usuario do banco
-- Conceder uso do schema
GRANT USAGE ON SCHEMA public TO user_name;

-- Conceder acesso às tabelas existentes
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO user_name;

-- Conceder acesso às sequences (MUITO IMPORTANTE)
-- Sem isso, inserts falham mesmo com INSERT liberado.
GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA public
TO user_name;

-- Garantir permissões para tabelas futuras
ALTER DEFAULT PRIVILEGES
IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES TO user_name;

ALTER DEFAULT PRIVILEGES
IN SCHEMA public
GRANT USAGE, SELECT, UPDATE
ON SEQUENCES TO user_name;