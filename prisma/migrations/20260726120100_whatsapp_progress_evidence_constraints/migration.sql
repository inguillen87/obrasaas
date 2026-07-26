-- Phase 2: install tenant-scoped provenance references without scanning legacy
-- rows. NOT VALID still enforces both foreign keys for every new or changed row.
ALTER TABLE "ProgressEvidence"
  ADD CONSTRAINT "ProgressEvidence_source_conversation_scope_fkey"
  FOREIGN KEY ("projectId", "sourceConversationId")
  REFERENCES "Conversation"("projectId", "id")
  ON DELETE NO ACTION
  ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID,
  ADD CONSTRAINT "ProgressEvidence_source_message_scope_fkey"
  FOREIGN KEY ("sourceConversationId", "sourceMessageId")
  REFERENCES "Message"("conversationId", "id")
  ON DELETE NO ACTION
  ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;
