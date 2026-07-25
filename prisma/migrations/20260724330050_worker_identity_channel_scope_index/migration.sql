-- One concurrent statement per migration keeps PostgreSQL outside an implicit transaction.
CREATE UNIQUE INDEX CONCURRENTLY "WhatsAppConnection_projectId_id_key"
ON "WhatsAppConnection"("projectId", "id");
