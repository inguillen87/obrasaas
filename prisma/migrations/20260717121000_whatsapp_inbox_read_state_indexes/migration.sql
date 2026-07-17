-- These indexes cover hot inbox pagination and unread-count paths. Build them
-- outside a transaction so PostgreSQL keeps accepting message/webhook writes.
-- Dropping first also repairs an INVALID index left by an interrupted
-- concurrent build when the migration is explicitly resolved and retried.
-- PostgreSQL forbids DROP INDEX CONCURRENTLY in Prisma's migration execution
-- block, so the rare retry cleanup uses a regular, short drop; the expensive
-- index builds themselves remain concurrent.
DROP INDEX IF EXISTS "Conversation_projectId_channel_updatedAt_id_idx";
CREATE INDEX CONCURRENTLY "Conversation_projectId_channel_updatedAt_id_idx"
ON "Conversation"("projectId", "channel", "updatedAt", "id");

DROP INDEX IF EXISTS "Message_conversationId_createdAt_id_idx";
CREATE INDEX CONCURRENTLY "Message_conversationId_createdAt_id_idx"
ON "Message"("conversationId", "createdAt", "id");

DROP INDEX IF EXISTS "Message_conversationId_direction_createdAt_id_idx";
CREATE INDEX CONCURRENTLY "Message_conversationId_direction_createdAt_id_idx"
ON "Message"("conversationId", "direction", "createdAt", "id");
