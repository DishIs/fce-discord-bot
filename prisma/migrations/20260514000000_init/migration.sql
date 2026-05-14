-- CreateTable
CREATE TABLE "User" (
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "planLabel" TEXT NOT NULL DEFAULT 'Free',
    "commandCount" INTEGER NOT NULL DEFAULT 0,
    "feedbackSent" BOOLEAN NOT NULL DEFAULT false,
    "jsonMode" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("discordId")
);

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "inbox" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "guildId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "commandCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginState" (
    "state" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginState_pkey" PRIMARY KEY ("state")
);

-- CreateIndex
CREATE INDEX "Watch_active_idx" ON "Watch"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Watch_discordId_inbox_key" ON "Watch"("discordId", "inbox");

-- CreateIndex
CREATE INDEX "LoginState_discordId_idx" ON "LoginState"("discordId");

-- AddForeignKey
ALTER TABLE "Watch" ADD CONSTRAINT "Watch_discordId_fkey" FOREIGN KEY ("discordId") REFERENCES "User"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_discordId_fkey" FOREIGN KEY ("discordId") REFERENCES "User"("discordId") ON DELETE CASCADE ON UPDATE CASCADE;
