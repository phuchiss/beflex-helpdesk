CREATE TABLE email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_username VARCHAR(255) NOT NULL,
    imap_password_encrypted VARCHAR(500) NOT NULL,
    imap_tls BOOLEAN NOT NULL DEFAULT true,
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_polled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track processed emails to prevent duplicates
CREATE TABLE email_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(500) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    UNIQUE(email_account_id, message_id)
);

CREATE INDEX idx_email_processing_log_message_id ON email_processing_log(email_account_id, message_id);
