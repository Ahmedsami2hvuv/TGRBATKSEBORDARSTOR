-- CreateEnum
CREATE TYPE "PortalChatRole" AS ENUM ('admin', 'mandoub', 'preparer', 'supplier');

-- CreateTable
CREATE TABLE "PortalChatThread" (
    "id" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "PortalChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalChatParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "PortalChatRole" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalChatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderRole" "PortalChatRole" NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalChatThread_uniqueKey_key" ON "PortalChatThread"("uniqueKey");

-- CreateIndex
CREATE INDEX "PortalChatThread_lastMessageAt_idx" ON "PortalChatThread"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalChatParticipant_threadId_role_actorId_key" ON "PortalChatParticipant"("threadId", "role", "actorId");

-- CreateIndex
CREATE INDEX "PortalChatParticipant_role_actorId_idx" ON "PortalChatParticipant"("role", "actorId");

-- CreateIndex
CREATE INDEX "PortalChatMessage_threadId_createdAt_idx" ON "PortalChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalChatMessage_senderRole_senderId_idx" ON "PortalChatMessage"("senderRole", "senderId");

-- AddForeignKey
ALTER TABLE "PortalChatParticipant" ADD CONSTRAINT "PortalChatParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "PortalChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalChatMessage" ADD CONSTRAINT "PortalChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "PortalChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
