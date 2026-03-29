CREATE TABLE ticket_participants (
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX idx_ticket_participants_user_id ON ticket_participants(user_id);
CREATE INDEX idx_ticket_participants_ticket_id ON ticket_participants(ticket_id);
