-- Persist a monotonic, per-platform-user read cursor for every conversation.
-- The marker stores the complete message ordering tuple so equal timestamps
-- cannot accidentally mark a concurrent inbound message as read.
-- Existing threads receive a one-time baseline, preventing a deployment from
-- turning their complete historical backlog into artificial unread work.
BEGIN;

ALTER TABLE "Conversation"
ADD COLUMN "unreadTrackingStartedAt" TIMESTAMP(3);

UPDATE "Conversation"
SET "unreadTrackingStartedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "ConversationReadState" (
    "conversationId" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "lastReadMessageId" TEXT NOT NULL,
    "lastReadCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationReadState_pkey" PRIMARY KEY ("conversationId", "platformUserId")
);

CREATE INDEX "ConversationReadState_platformUserId_updatedAt_idx"
ON "ConversationReadState"("platformUserId", "updatedAt");

ALTER TABLE "ConversationReadState"
ADD CONSTRAINT "ConversationReadState_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationReadState"
ADD CONSTRAINT "ConversationReadState_platformUserId_fkey"
FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
