-- Things the AI learns from: staff-written replies (qa), corrections of its own
-- replies (correction) and real agent replies (agent). Only approved rows with an
-- embedding are retrieved.
CREATE TABLE "ai_examples" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "context" TEXT,
    "answer" TEXT NOT NULL,
    "badAnswer" TEXT,
    "embedding" vector(1536),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "sourceKey" TEXT,
    "agentName" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_examples_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_examples_sourceKey_key" ON "ai_examples"("sourceKey");
CREATE INDEX "ai_examples_kind_approved_idx" ON "ai_examples"("kind", "approved");

-- Every reply the AI sent, so staff can review and correct it.
CREATE TABLE "ai_reply_logs" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "conversationId" TEXT,
    "customerName" TEXT,
    "customerMessage" TEXT NOT NULL,
    "context" TEXT,
    "aiReply" TEXT NOT NULL,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "topScore" DOUBLE PRECISION,
    "sources" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "correctionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reply_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_reply_logs_createdAt_idx" ON "ai_reply_logs"("createdAt");
CREATE INDEX "ai_reply_logs_status_idx" ON "ai_reply_logs"("status");
