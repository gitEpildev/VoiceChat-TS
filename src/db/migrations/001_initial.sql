CREATE TABLE IF NOT EXISTS guild_config (
  "guildId" VARCHAR(20) PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  "categoryId" VARCHAR(20),
  "creatorChannelId" VARCHAR(20),
  "controlPanelChannelId" VARCHAR(20),
  "controlPanelMessageId" VARCHAR(20),
  "logChannelId" VARCHAR(20),
  "nameTemplate" TEXT NOT NULL DEFAULT '{username}''s Room',
  "brandColor" VARCHAR(7) NOT NULL DEFAULT '#5865F2',
  "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
  "deleteDelaySeconds" INTEGER NOT NULL DEFAULT 300,
  "claimTimeoutSeconds" INTEGER NOT NULL DEFAULT 120,
  "maxChannelsPerUser" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS voice_channels (
  "voiceChannelId" VARCHAR(20) PRIMARY KEY,
  "guildId" VARCHAR(20) NOT NULL,
  "textChannelId" VARCHAR(20) NOT NULL,
  "ownerId" VARCHAR(20) NOT NULL,
  "createdAt" BIGINT NOT NULL,
  "lastOwnerSeenAt" BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS cooldowns (
  "guildId" VARCHAR(20) NOT NULL,
  "userId" VARCHAR(20) NOT NULL,
  "lastCreatedAt" BIGINT NOT NULL,
  PRIMARY KEY ("guildId", "userId")
);
