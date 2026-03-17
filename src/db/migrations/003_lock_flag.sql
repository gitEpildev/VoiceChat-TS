-- Lock flag for voice channels (owner lock/unlock)
ALTER TABLE voice_channels
ADD COLUMN IF NOT EXISTS "locked" BOOLEAN NOT NULL DEFAULT FALSE;

