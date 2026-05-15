CREATE TABLE "Guild" (
    "guildId"     TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "memberCount" INTEGER     NOT NULL DEFAULT 0,
    "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt"      TIMESTAMP(3),
    "active"      BOOLEAN     NOT NULL DEFAULT true,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Guild_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE "CommandLog" (
    "id"        TEXT         NOT NULL,
    "guildId"   TEXT,
    "discordId" TEXT         NOT NULL,
    "command"   TEXT         NOT NULL,
    "latencyMs" INTEGER      NOT NULL,
    "success"   BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommandLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommandLog_guildId_idx" ON "CommandLog"("guildId");
CREATE INDEX "CommandLog_createdAt_idx" ON "CommandLog"("createdAt");
