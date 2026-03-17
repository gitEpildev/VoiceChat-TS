-- Admin Lock flag for voice channels
ALTER TABLE voice_channels
ADD COLUMN IF NOT EXISTS "adminLocked" BOOLEAN NOT NULL DEFAULT FALSE;

