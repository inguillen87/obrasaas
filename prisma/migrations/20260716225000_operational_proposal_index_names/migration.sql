-- PostgreSQL truncated both original Prisma-generated names at 63 bytes.
-- Give them explicit stable names so schema introspection stays drift-free.
ALTER INDEX "OperationalProposal_projectId_sourceProvider_sourceExternalId_k"
RENAME TO "OperationalProposal_source_event_key";

ALTER INDEX "OperationalProposal_projectId_resolverProvider_resolverExternal"
RENAME TO "OperationalProposal_resolver_event_key";
