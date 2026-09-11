ALTER TABLE "tbUsers"
    ADD COLUMN IF NOT EXISTS central_subject VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_central_subject
    ON "tbUsers"(central_subject)
    WHERE central_subject IS NOT NULL AND is_deleted = FALSE;
