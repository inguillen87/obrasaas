-- Supports the per-endpoint rolling rate window and bounded oldest-first GC.
-- The existing (endpointId, status, createdAt) index cannot serve queries that
-- do not constrain status because status sits between the two useful columns.
CREATE INDEX "WhatsAppFlowEndpointRequest_endpointId_createdAt_idx"
ON "WhatsAppFlowEndpointRequest"("endpointId", "createdAt");
