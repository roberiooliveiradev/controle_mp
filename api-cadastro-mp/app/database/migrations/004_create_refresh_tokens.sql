CREATE TABLE IF NOT EXISTS "tbRefreshTokens" (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    jti VARCHAR(64) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_jti VARCHAR(64),
    reason VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES "tbUsers"(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_token_hash
    ON "tbRefreshTokens"(token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS ux_refresh_jti
    ON "tbRefreshTokens"(jti);

CREATE INDEX IF NOT EXISTS ix_refresh_user_id
    ON "tbRefreshTokens"(user_id);

CREATE INDEX IF NOT EXISTS ix_refresh_expires
    ON "tbRefreshTokens"(expires_at);
