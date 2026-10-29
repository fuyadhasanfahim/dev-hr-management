-- Which AI asked: the WhatsApp assistant or the website chat. Existing rows keep "whatsapp".
ALTER TABLE "knowledge_gaps" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'whatsapp';
CREATE INDEX "knowledge_gaps_channel_idx" ON "knowledge_gaps"("channel");
