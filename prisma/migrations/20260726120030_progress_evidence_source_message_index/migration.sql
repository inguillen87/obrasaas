-- A source WhatsApp message may produce at most one canonical evidence row.
CREATE UNIQUE INDEX CONCURRENTLY "ProgressEvidence_sourceMessageId_key"
  ON "ProgressEvidence"("sourceMessageId");
