-- Message is written by the webhook hot path, so this candidate key must be
-- built concurrently and isolated from every other migration statement.
CREATE UNIQUE INDEX CONCURRENTLY "Message_conversationId_id_key"
  ON "Message"("conversationId", "id");
