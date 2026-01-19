CREATE TABLE IF NOT EXISTS "tbRevokedTokens" (
  id BIGSERIAL PRIMARY KEY,
  jti VARCHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(100),
  is_deleted BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_revoked_user FOREIGN KEY (user_id) REFERENCES "tbUsers"(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_revoked_tokens_jti
ON "tbRevokedTokens"(jti);

CREATE INDEX IF NOT EXISTS ix_revoked_tokens_expires_at
ON "tbRevokedTokens"(expires_at);
