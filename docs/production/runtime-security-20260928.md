# Production runtime security update — 2026-09-28

Base: ec7f0a509867e0b397c8184b9f528c0b7d316667. Scope is master/production; it is not a promotion of the enterprise Preview.

## Changes
Next.js and eslint-config-next are pinned together at 16.3.6. The official September 22 advisory recommends that version for the active LTS line. The existing release was 16.2.9. The advisory's critical ImageResponse issue depends on specific usage; no live exploit or compromise is asserted by this update.

Targeted overrides: fast-uri 3.1.6, mysql2 3.23.1, baseline-browser-mapping 2.11.0, and deepmerge-ts 8.0.0 under @prisma/config. The same overrides already exist on the enterprise branch; they are validated again for this legacy production tree. Prisma remains on major 7 with its existing adapter/client versions, rather than accepting an audit suggestion to downgrade to major 6.

Lockfile-only installation used --ignore-scripts during preparation. Clean CI runs npm ci, its Prisma generate hook, pure production tests, affected lint, npm audit --omit=dev --audit-level=low, the normal complete Next build and the existing built-application browser/HTTP/offline verification.

## Audit observation
Before updating: npm audit --omit=dev reported 10 vulnerable package entries (1 critical, 8 high, 1 moderate).
After updating Next alone: 6 entries, none critical. After the four targeted overrides: 0 entries reported.
These are registry audit observations, not a penetration test or proof that all code is secure. npm audit counts affected package entries and dependency chains, not necessarily distinct exploitable issues.

## Preserved behavior
The public site stays available, verified-service authorization remains required for private legacy APIs and operational pages, old deployment URLs remain protected, and no simulated browser login is restored. No secrets, database URLs, schemas, migration histories, records or message dispatch settings are modified by this application release. Business access remains restricted pending live identity and the enterprise cutover prerequisites.

## Follow-through
The domain-specific Clerk production setup remains external and unconfigured. Separately, the existing Neon snapshot was restored into a new isolated branch for data migration rehearsal; no main-branch SQL writes were authorized by this runtime patch. Its database results are documented separately and must not be presented as a migration of production.

Official source: https://nextjs.org/blog/nextjs-security-update-september-22-2026
Record exact CI run, commit, deployment and post-release checks in the product PR after verification.
