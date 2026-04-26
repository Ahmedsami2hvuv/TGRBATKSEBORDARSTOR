-- CreateTable
CREATE TABLE "TelegramBotSession" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "step" TEXT NOT NULL DEFAULT 'idle',
    "orderNumber" INTEGER,
    "payload" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramBotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramBotSession_telegramUserId_key" ON "TelegramBotSession"("telegramUserId");
