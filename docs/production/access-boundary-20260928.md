# Production hotfix — existing application access boundary

Scope: patch the application currently served by obrasaas.vercel.app; this is not a promotion of the enterprise Preview branch. Baseline master: 0ff2bb23f549eb65016f993a8d587865bb56618c. The deployed source hashes for auth, layout, state API, sign-in, package/lockfile and Next/Vercel configuration matched that working copy before modification.

## Intent and user-visible effect
Public marketing remains online. The previous browser-only sign-in/sign-up forms are replaced by an explicit restricted-access notice; there is no password collection or simulated enterprise session. Private pages redirect there. Legacy API reads and writes require the existing server-side INTERNAL_API_SECRET. This is a service credential, not a tenant login or replacement for the enterprise RBAC system.

No hardcoded key, browser role flag, Origin/Referer or missing-secret fallback grants access. The observed state endpoint has an additional handler guard before reading/parsing/writing. Proxy covers other legacy APIs and private routes. Public health separately reports public-site availability and restricted operational access; it does not claim database, Meta or Clerk readiness.

Meta's incoming endpoint requires its configured secret and exact body signature, before parsing/processing. Its verification challenge only accepts the configured META_VERIFY_TOKEN. Missing configuration returns 503 without acknowledging processing. The remaining legacy field/KYC/billing endpoints are restricted to service callers, not publicly promoted as safe worker/account flows.

This containment intentionally does NOT restore customer login or certify the legacy backend as a multi-tenant production SaaS. End-user operations stay restricted until live identity, route compatibility, storage and migration acceptance are complete. Do not give service credentials to browsers or put them into localStorage to get around that condition.

## Browser state
Service worker v4 removes only old ObraSaaS caches and never serves private API/page data from cache. Network failure returns an explicit unavailable response. The old IndexedDB queue is kept intact, but automatic replay is removed. This is not an offline-write implementation or a guarantee of recovery after tab closure. Only obsolete local login/role/demo flags are cleared.

## Release checks
- Pure auth, route inventory, protocol, cache and UI-source checks: node --test tests/production-access-boundary.test.mjs.
- Clean locked dependency installation and standard npm run build; no migration command.
- Built Next application: node scripts/verify-production-boundary.mjs. Uses synthetic service credentials and no real database. Exercises denied GET/POST/DELETE, forged headers, protected navigation, public resources, browser viewports, old cache retirement and retained queue.
- Check domain identity before promotion and verify the stable domain after the release. No production records, invoices, worksite messages or keys are changed by the test.

The original deploy remains the rollback reference: dpl_5NFDJP9vp83AcuR5aNHwiEyRfQyn. Restoring it would also restore the old access exposure; it is not a permanent security remedy. The enterprise branch 1677ff7 and its preflight checks are unchanged. Its 4514 tests are NOT claimed as tests of this different legacy hotfix.

Hotfix and operations Git branches do not automatically create Vercel Previews. Actual build/deployment IDs and acceptance results are recorded only after execution.
