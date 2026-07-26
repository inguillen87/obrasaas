-- Candidate key for the tenant-scoped message provenance foreign key.
CREATE UNIQUE INDEX CONCURRENTLY "ProgressEvidence_source_conversation_message_key"
  ON "ProgressEvidence"("sourceConversationId", "sourceMessageId");
