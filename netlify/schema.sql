CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    nombre TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    event_id UUID NOT NULL REFERENCES eventos (id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, nombre)
);

CREATE TABLE IF NOT EXISTS gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    event_id UUID NOT NULL REFERENCES eventos (id) ON DELETE CASCADE,
    participante_id UUID NOT NULL REFERENCES participantes (id) ON DELETE RESTRICT,
    item TEXT NOT NULL,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS participantes_event_id_idx ON participantes (event_id);

CREATE INDEX IF NOT EXISTS gastos_event_id_idx ON gastos (event_id);