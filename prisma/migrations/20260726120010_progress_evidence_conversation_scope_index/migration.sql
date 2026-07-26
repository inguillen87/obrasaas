-- One concurrent statement per migration keeps PostgreSQL outside an implicit
-- transaction and avoids blocking the hot WhatsApp conversation write path.
CREATE UNIQUE INDEX CONCURRENTLY "Conversation_projectId_id_key"
  ON "Conversation"("projectId", "id");
