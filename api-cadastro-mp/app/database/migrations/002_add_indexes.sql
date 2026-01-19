BEGIN;

-- tbRoles
CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_role_name
    ON "tbRoles"(role_name);

-- tbUsers
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email
    ON "tbUsers"(email);

CREATE INDEX IF NOT EXISTS ix_users_role_id
    ON "tbUsers"(role_id);

-- tbConversations
CREATE INDEX IF NOT EXISTS ix_conv_title
    ON "tbConversations"(title);

CREATE INDEX IF NOT EXISTS ix_conv_created_by
    ON "tbConversations"(created_by);

CREATE INDEX IF NOT EXISTS ix_conv_assigned_to
    ON "tbConversations"(assigned_to);

-- tbMessageTypes
CREATE INDEX IF NOT EXISTS ix_messages_conversation_type_created
    ON "tbMessages"(conversation_id, message_type_id, created_at)
WHERE is_deleted = FALSE;


-- tbMessages
CREATE INDEX IF NOT EXISTS ix_msg_conversation_id
    ON "tbMessages"(conversation_id);

CREATE INDEX IF NOT EXISTS ix_msg_sender_id
    ON "tbMessages"(sender_id);

CREATE INDEX IF NOT EXISTS ix_msg_conversation_created_at
    ON "tbMessages"(conversation_id, created_at);

-- tbMessageFiles
CREATE INDEX IF NOT EXISTS ix_mfiles_message_id
    ON "tbMessageFiles"(message_id);

CREATE INDEX IF NOT EXISTS ix_mfiles_message_id_not_deleted
    ON "tbMessageFiles"(message_id)
WHERE is_deleted = FALSE;

--tbConversationParticipants
-- 1 usuário não pode aparecer 2x na mesma conversa
CREATE UNIQUE INDEX IF NOT EXISTS ux_participant_conv_user
    ON "tbConversationParticipants"(conversation_id, user_id)
WHERE is_deleted = FALSE;

-- acelerar consultas de unread
CREATE INDEX IF NOT EXISTS ix_participant_user
    ON "tbConversationParticipants"(user_id)
WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS ix_participant_conv
    ON "tbConversationParticipants"(conversation_id)
WHERE is_deleted = FALSE;

-- índice para leitura
CREATE INDEX IF NOT EXISTS idx_participants_last_read
ON "tbConversationParticipants"(conversation_id, last_read_message_id);

-- tbRequest
CREATE INDEX IF NOT EXISTS idx_request_message
    ON "tbRequest"(message_id);

-- tbRequestItem
CREATE INDEX IF NOT EXISTS ix_ritem_request_id
    ON "tbRequestItem"(request_id);

CREATE INDEX IF NOT EXISTS ix_ritem_request_id_not_deleted
    ON "tbRequestItem"(request_id)
WHERE is_deleted = FALSE;

-- tbRequestItemFields
CREATE INDEX IF NOT EXISTS ix_rifields_request_item_id
    ON "tbRequestItemFields"(request_items_id);

CREATE INDEX IF NOT EXISTS ix_rifields_request_item_id_not_deleted
    ON "tbRequestItemFields"(request_items_id)
WHERE is_deleted = FALSE;

-- tbProductFields
CREATE UNIQUE INDEX IF NOT EXISTS ux_pfields_product_tag_not_deleted
ON "tbProductFields" (product_id, field_tag)
WHERE is_deleted = FALSE;

 -- tbRequestItemFields
CREATE UNIQUE INDEX IF NOT EXISTS ux_rifields_item_tag_not_deleted
ON "tbRequestItemFields" (request_items_id, field_tag)
WHERE is_deleted = FALSE;

-- audit_log
CREATE INDEX IF NOT EXISTS ix_audit_entity
    ON audit_log(entity_name, entity_id);

CREATE INDEX IF NOT EXISTS ix_audit_user
    ON audit_log(user_id);

COMMIT;
