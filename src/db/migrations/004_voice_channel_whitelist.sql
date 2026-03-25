-- Whitelist entries for a voice channel (exempt from Admin Lock kicks and join blocks)
CREATE TABLE IF NOT EXISTS voice_channel_whitelist (
  "voiceChannelId" VARCHAR(20) NOT NULL,
  "userId" VARCHAR(20) NOT NULL,
  "addedByUserId" VARCHAR(20) NOT NULL,
  "addedAt" BIGINT NOT NULL,
  PRIMARY KEY ("voiceChannelId", "userId")
);

