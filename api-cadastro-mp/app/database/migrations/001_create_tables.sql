BEGIN;

-- =========================
-- tbRoles
-- =========================
CREATE TABLE IF NOT EXISTS "tbRoles" (
    id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(100) NOT NULL,
    permissions VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- =========================
-- tbUsers
-- =========================
CREATE TABLE IF NOT EXISTS "tbUsers" (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_algo VARCHAR(50) NOT NULL,
    password_iterations INTEGER NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_users_role
        FOREIGN KEY (role_id) REFERENCES "tbRoles"(id)
);

-- =========================
-- tbConversations
-- =========================
CREATE TABLE IF NOT EXISTS "tbConversations" (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    created_by BIGINT NOT NULL,
    assigned_to BIGINT,
    has_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ not NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_conv_creator
        FOREIGN KEY (created_by) REFERENCES "tbUsers"(id),
    CONSTRAINT fk_conv_assignee
        FOREIGN KEY (assigned_to) REFERENCES "tbUsers"(id)
);

-- =========================
-- tbMessageTypes
-- =========================
CREATE TABLE IF NOT EXISTS "tbMessageTypes" (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) NOT NULL,      -- TEXT | REQUEST | SYSTEM
    description VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- =========================
-- tbMessages
-- =========================
CREATE TABLE IF NOT EXISTS "tbMessages" (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    body TEXT,
    message_type_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_msg_conversation
        FOREIGN KEY (conversation_id) REFERENCES "tbConversations"(id),
    CONSTRAINT fk_msg_sender
        FOREIGN KEY (sender_id) REFERENCES "tbUsers"(id),
    CONSTRAINT fk_msg_type
        FOREIGN KEY (message_type_id) REFERENCES "tbMessageTypes"(id)
);

-- =========================
-- tbMessageFiles
-- =========================
CREATE TABLE IF NOT EXISTS "tbMessageFiles" (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size_bytes BIGINT,
    sha256 CHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_mfiles_message
        FOREIGN KEY (message_id) REFERENCES "tbMessages"(id)
);

-- =========================
-- tbRequestType
-- =========================
CREATE TABLE IF NOT EXISTS "tbConversationParticipants" (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,

    -- ponteiro de leitura (recomendado)
    last_read_message_id BIGINT,
    last_read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,

    CONSTRAINT fk_part_conv
        FOREIGN KEY (conversation_id) REFERENCES "tbConversations"(id),

    CONSTRAINT fk_part_user
        FOREIGN KEY (user_id) REFERENCES "tbUsers"(id),

    CONSTRAINT fk_part_last_msg
        FOREIGN KEY (last_read_message_id) REFERENCES "tbMessages"(id)
);

-- =========================
-- tbRequestType
-- =========================
CREATE TABLE IF NOT EXISTS "tbRequestType"(
    id BIGSERIAL PRIMARY KEY,
    type_name VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- =========================
-- tbRequestStatus
-- =========================
CREATE TABLE IF NOT EXISTS "tbRequestStatus"(
    id BIGSERIAL PRIMARY KEY,
    status_name VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- =========================
-- tbFieldType
-- =========================
CREATE TABLE IF NOT EXISTS "tbFieldType"(
    id BIGSERIAL PRIMARY KEY,
    type_name VARCHAR(255) NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- =========================
-- tbRequest
-- =========================
CREATE TABLE IF NOT EXISTS "tbRequest"(
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL UNIQUE,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_request_message
        FOREIGN KEY (message_id) REFERENCES "tbMessages"(id),
    CONSTRAINT fk_request_user
        FOREIGN KEY (created_by) REFERENCES "tbUsers"(id)
);

-- =========================
-- tbProduct
-- =========================
CREATE TABLE IF NOT EXISTS "tbProduct" (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- =========================
-- tbProductFields
-- =========================
CREATE TABLE IF NOT EXISTS "tbProductFields" (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    field_type_id BIGINT NOT NULL,
    field_tag VARCHAR(255) NOT NULL,
    field_value TEXT,
    field_flag TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_pfields_product
        FOREIGN KEY (product_id) REFERENCES "tbProduct"(id),
    CONSTRAINT fk_pfields_ftype
        FOREIGN KEY (field_type_id) REFERENCES "tbFieldType"(id)
);

-- =========================
-- tbRequestItem
-- =========================
CREATE TABLE IF NOT EXISTS "tbRequestItem"(
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    product_id BIGINT DEFAULT NULL,
    request_type_id BIGINT NOT NULL,
    request_status_id BIGINT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_ritem_requests
        FOREIGN KEY (request_id) REFERENCES "tbRequest"(id),
    CONSTRAINT fk_ritem_rtype
        FOREIGN KEY (request_type_id) REFERENCES "tbRequestType"(id),
    CONSTRAINT fk_ritem_rstatus
        FOREIGN KEY (request_status_id) REFERENCES "tbRequestStatus"(id),
    -- CONSTRAINT fk_ritem_product
    --     FOREIGN KEY (product_id) REFERENCES "tbProduct"(id)
);

-- =========================
-- tbRequestItemFields
-- =========================
CREATE TABLE IF NOT EXISTS "tbRequestItemFields" (
    id BIGSERIAL PRIMARY KEY,
    request_items_id BIGINT NOT NULL,
    field_type_id BIGINT NOT NULL,
    field_tag VARCHAR(255) NOT NULL,
    field_value TEXT,
    field_flag TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_rifields_ritem
        FOREIGN KEY (request_items_id) REFERENCES "tbRequestItem"(id),
    CONSTRAINT fk_rifields_ftype
        FOREIGN KEY (field_type_id) REFERENCES "tbFieldType"(id)
);

-- =========================
-- audit_log
-- =========================
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    entity_name VARCHAR(50) NOT NULL,
    entity_id BIGINT,
    action_name VARCHAR(20) NOT NULL,
    details TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    user_id BIGINT,
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES "tbUsers"(id)
);

COMMIT;
