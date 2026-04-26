-- Add Telegram user id to Courier
ALTER TABLE "Courier" ADD COLUMN "telegramUserId" TEXT;

-- Create unique index for Telegram user id
CREATE UNIQUE INDEX "Courier_telegramUserId_key" ON "Courier"("telegramUserId");

