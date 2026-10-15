import {createHash} from 'node:crypto';
import {kycExpiredCurrentSourceFiles,KYC_EXPIRED_CURRENT_ADDITIONS,KYC_EXPIRED_CURRENT_REVIEWED_SOURCES,validateKycExpiredCurrentWorkspaceContract} from './kyc-expired-current-ci-lineage.mjs';

export const PLAN_MEASUREMENT_CURRENT_CI_VERSION='plan-measurement-current-lineage-v1';
export const PLAN_MEASUREMENT_CURRENT_CI_HELPER='scripts/lib/plan-measurement-current-ci-lineage.mjs';
export const PLAN_MEASUREMENT_CURRENT_CI_TEST='tests/production-plan-measurement-current-ci-lineage.test.mjs';
export const PLAN_MEASUREMENT_CURRENT_SOURCES=Object.freeze(['src/lib/plan-measurement-policy.mjs','src/lib/plan-measurement-source.mjs']);
export const PLAN_MEASUREMENT_PUBLISHED_H_CONTRACT_SHA256='9dab901cb93f3834cad0f1ea9ba386c5bb12acc913463a7dfb6368847af3fd37';
export const PLAN_MEASUREMENT_PUBLISHED_H_KYC_SHA256='6ac6cb2e19c9d3ecc803bfc556e62e316701754c7252734503699841e1ed2533';
export const PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES=Object.freeze([
  {
    "id": "bank-intake-units",
    "kind": "UNIT",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 132,
    "previousSourcePathsSha256": "edaaa7384dc848b6bba0fc89f083cf27a8bd2296933c7747e5798648e038f50b",
    "currentSourceCount": 134,
    "currentSourcePathsSha256": "811727640bf501ae3b7b918a0330e4289e014dd8ec4a250448b954584338823d",
    "previousProducerSha256": "470cdeddcce7ddf8117ca4bffeb45fc2733135aac59b399b468fd915b4b5628f",
    "currentProducerSha256": "470cdeddcce7ddf8117ca4bffeb45fc2733135aac59b399b468fd915b4b5628f",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "bank-postgres",
    "kind": "PG_BANK",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 16,
    "previousSourcePathsSha256": "7b09b899f67f1e1a3cab8929233dc85fdefc795c587c844691690127c3d5782a",
    "currentSourceCount": 18,
    "currentSourcePathsSha256": "ee94b61d206c1493aa68d6bb1b8b83f925a55d814e362b09292e009fc8deb9a4",
    "previousProducerSha256": "f4f464c1e192006bda8616e956e7aa2d2766832020516c5209d1a0ad89f90cc7",
    "currentProducerSha256": "0a4f6010711423ac51ca3d219973789609cf864c5ca88e19a42868cd43741f88",
    "allowedFields": [
      "sourceFiles",
      "producerSha256"
    ]
  },
  {
    "id": "intake-postgres",
    "kind": "PG_INTAKE",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 30,
    "previousSourcePathsSha256": "9ab9e84d18f4c45e1fb1627edd3a5cc4b599817f7786b46713f3994df1ef35dc",
    "currentSourceCount": 32,
    "currentSourcePathsSha256": "f1570f201a21092710528999618e24149ae9d478ddd2c832c007f1b29f40e5a6",
    "previousProducerSha256": "6028c4b9136941ecac495d1ca60f74dbf6d0c997e00ddea93d24b6406ac5b3bd",
    "currentProducerSha256": "d571468725a6679b4f03ea78c5a7be187514f616c2e2248d66e62b97dafe1284",
    "allowedFields": [
      "sourceFiles",
      "producerSha256"
    ]
  },
  {
    "id": "bank-ui",
    "kind": "UI_BANK",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 133,
    "previousSourcePathsSha256": "96a64d600036e45ee5c685aa83ec11b3b19998301942b69d8d8895861929410d",
    "currentSourceCount": 135,
    "currentSourcePathsSha256": "3e21912a4dc7fc2cd5277a2191e4fdf02e0f9eb6243f67e7633d4c6f7e515d3d",
    "previousProducerSha256": "157b7e15a6bb3da14134b74ea9a878023c256b82b43cfaa8b3f91f30ccadfd9a",
    "currentProducerSha256": "157b7e15a6bb3da14134b74ea9a878023c256b82b43cfaa8b3f91f30ccadfd9a",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "joint-ui",
    "kind": "UI_JOINT",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 135,
    "previousSourcePathsSha256": "4dd0ab7bcbd2ebc28ef1605f172b8a988c22344ce36958b538088720b42d3683",
    "currentSourceCount": 137,
    "currentSourcePathsSha256": "fb5fd3ad5c020fc7ba83169c2e5cdf8d7d85dfffdea7b20fa5bae08ca8e63f33",
    "previousProducerSha256": "55c7ff7caf96501804ee9eb605a405f9a982cf20b1c1d0b007b8332dda925154",
    "currentProducerSha256": "55c7ff7caf96501804ee9eb605a405f9a982cf20b1c1d0b007b8332dda925154",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "joint-causal",
    "kind": "UI_CAUSAL",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 135,
    "previousSourcePathsSha256": "4dd0ab7bcbd2ebc28ef1605f172b8a988c22344ce36958b538088720b42d3683",
    "currentSourceCount": 137,
    "currentSourcePathsSha256": "fb5fd3ad5c020fc7ba83169c2e5cdf8d7d85dfffdea7b20fa5bae08ca8e63f33",
    "previousProducerSha256": "55c7ff7caf96501804ee9eb605a405f9a982cf20b1c1d0b007b8332dda925154",
    "currentProducerSha256": "55c7ff7caf96501804ee9eb605a405f9a982cf20b1c1d0b007b8332dda925154",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "company-kyc-postgres",
    "kind": "PG_COMPANY_KYC",
    "sourceAdditions": [
      "src/lib/plan-measurement-configuration.mjs",
      "src/lib/plan-measurement-http.mjs",
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs",
      "src/lib/plan-measurement-runtime.mjs",
      "src/lib/plan-measurement-store.mjs"
    ],
    "previousSourceCount": 220,
    "previousSourcePathsSha256": "b3239df8af4146e1bae607e4e4c9541c11b1917a87c05161e9be1e53424c0e02",
    "currentSourceCount": 226,
    "currentSourcePathsSha256": "879ffc9bb14310d4b2e23d911290690002f0bf479644573f7a6b019fe3d3222b",
    "previousProducerSha256": "825da6466a7f1ec4c500028785424a005be207e0ec25f894a96e6b9469fa1438",
    "currentProducerSha256": "825da6466a7f1ec4c500028785424a005be207e0ec25f894a96e6b9469fa1438",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "identity-only-ui",
    "kind": "UI_IDENTITY_ONLY",
    "sourceAdditions": [
      "src/app/(identity)/cuenta/plan-measurement-panel.js",
      "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
      "src/app/(identity)/cuenta/plan-measurement-view.mjs"
    ],
    "previousSourceCount": 134,
    "previousSourcePathsSha256": "f6feb1ac2ecd5a1943f606e09a3419d4539654840e8c7502bf9f32a58e34dde6",
    "currentSourceCount": 137,
    "currentSourcePathsSha256": "23a81982442eefb1597338a82793a745c8894bc38f8bcf44121991641d50c214",
    "previousProducerSha256": "f9b07f016b0ae9fe15497a63f6bc23ce996b42c45e29e19ef6c9e9f1a582e7d9",
    "currentProducerSha256": "f9b07f016b0ae9fe15497a63f6bc23ce996b42c45e29e19ef6c9e9f1a582e7d9",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "field-canonical-postgres",
    "kind": "PG_FIELD",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 121,
    "previousSourcePathsSha256": "85c941727747ba61d9551c416ebfdefcd70e00b07726482b0aec3aa8a30d4b5c",
    "currentSourceCount": 123,
    "currentSourcePathsSha256": "b968f65896faae226720facc5abf003fb748924ba21c6a596ce8e5b1a39ef845",
    "previousProducerSha256": "d3f099602fcd23fe5fcf7d5cb5aeefc46d87e9889fd6c832a3e7405f2e838a4c",
    "currentProducerSha256": "d3f099602fcd23fe5fcf7d5cb5aeefc46d87e9889fd6c832a3e7405f2e838a4c",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "overtime-canonical-postgres",
    "kind": "PG_OVERTIME",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 106,
    "previousSourcePathsSha256": "55d6d85b7a6e26f89d72fc8924e8bbd53d71c0b8f8eeb888b532d28c6de17c7f",
    "currentSourceCount": 108,
    "currentSourcePathsSha256": "0d636950bdbbe956f747ca5f4d135ae53807a3aeb30f4a823121d78b1a6253a5",
    "previousProducerSha256": "06f570e65eb336e83bd6449ca4f68049d9fbed0a6df1d8658df038d2091db96b",
    "currentProducerSha256": "06f570e65eb336e83bd6449ca4f68049d9fbed0a6df1d8658df038d2091db96b",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "plan-baseline-postgres",
    "kind": "PG_PLAN_BASELINE",
    "sourceAdditions": [
      "src/lib/plan-measurement-policy.mjs",
      "src/lib/plan-measurement-source.mjs"
    ],
    "previousSourceCount": 33,
    "previousSourcePathsSha256": "7ffbe7753426826dcd8e92695537a4f36f33bc8e164dbd006222dcb353da16a1",
    "currentSourceCount": 35,
    "currentSourcePathsSha256": "63b942d2eda55e280f5989cd0147dc9aff12e7f9cac3ac3592ea67071c0e95ea",
    "previousProducerSha256": "e6dd0da63d68af0816637e661c19530a62b4b91d71022f3d78fc6b29c7bc878c",
    "currentProducerSha256": "e6dd0da63d68af0816637e661c19530a62b4b91d71022f3d78fc6b29c7bc878c",
    "allowedFields": [
      "sourceFiles"
    ]
  },
  {
    "id": "document-curve-ui",
    "kind": "UI_DOCUMENT_CURVE",
    "sourceAdditions": [
      "src/lib/plan-measurement-source.mjs",
      "src/lib/progress-measurement-quantity.js",
      "src/lib/task-progress-measurement.js"
    ],
    "previousSourceCount": 33,
    "previousSourcePathsSha256": "396600e5a2e8d05733f746e2b86a31b31cc7ebf701386b223ee22e5918781c29",
    "currentSourceCount": 36,
    "currentSourcePathsSha256": "9c8ce105438aa20faa75408f1e4be895c6c0ef144faacd410968aa9b70438fa5",
    "previousProducerSha256": "eaed425d6fe1e24859611afbf84c318db5457f9541d9afc0f27cc1187858a3e8",
    "currentProducerSha256": "eaed425d6fe1e24859611afbf84c318db5457f9541d9afc0f27cc1187858a3e8",
    "allowedFields": [
      "sourceFiles"
    ]
  }
].map(row=>Object.freeze(row)));
export const PLAN_MEASUREMENT_CURRENT_VALIDATION_PATHS=Object.freeze([
  ".github/workflows/task-measurement.yml",
  "scripts/lib/kyc-expired-current-ci-lineage.mjs",
  "scripts/lib/plan-measurement-consumer-ci-lineage.mjs",
  "scripts/lib/plan-measurement-current-ci-lineage.mjs",
  "scripts/verify-company-kyc-outbound-compact-ci.mjs",
  "scripts/verify-consumption-feedback-ci.mjs",
  "scripts/verify-kyc-reply-feedback-ci.mjs",
  "scripts/verify-organization-usage-ci.mjs",
  "scripts/verify-plan-import-boundary.mjs",
  "scripts/verify-plan-measurement-ci.mjs",
  "scripts/verify-plan-measurement-postgres.mjs",
  "scripts/verify-plan-measurement-ui.mjs",
  "scripts/verify-workspace-plan-recovery-ui.mjs",
  "src/app/(identity)/cuenta/plan-import-panel.js",
  "src/app/(identity)/cuenta/plan-measurement-panel.js",
  "src/app/(identity)/cuenta/plan-measurement-panel.module.css",
  "src/app/(identity)/cuenta/plan-measurement-view.mjs",
  "src/app/(identity)/cuenta/workspace-client.js",
  "src/app/(identity)/cuenta/workspace-recovery-journal.mjs",
  "src/app/(identity)/cuenta/workspace-recovery-panel.js",
  "src/app/api/identity/plan-measurement/route.js",
  "src/lib/organization-usage-policy.mjs",
  "src/lib/plan-import-analyzer.mjs",
  "src/lib/plan-import-ooxml.mjs",
  "src/lib/plan-import-policy.mjs",
  "src/lib/plan-import-store.mjs",
  "src/lib/plan-measurement-configuration.mjs",
  "src/lib/plan-measurement-http.mjs",
  "src/lib/plan-measurement-policy.mjs",
  "src/lib/plan-measurement-runtime.mjs",
  "src/lib/plan-measurement-source.mjs",
  "src/lib/plan-measurement-store.mjs",
  "tests/fixtures/plan-measurement-ci-unit.mjs",
  "tests/fixtures/plan-measurement-source-synthetic.mjs",
  "tests/fixtures/plan-measurement-store-synthetic.mjs",
  "tests/production-kyc-reply-feedback-ci.test.mjs",
  "tests/production-kyc-reply-feedback-current-lineage.test.mjs",
  "tests/production-material-consumption-feedback-ci.test.mjs",
  "tests/production-organization-usage-ci.test.mjs",
  "tests/production-plan-measurement-analyzer-http.test.mjs",
  "tests/production-plan-measurement-ci.test.mjs",
  "tests/production-plan-measurement-consumer-ci-lineage.test.mjs",
  "tests/production-plan-measurement-current-ci-lineage.test.mjs",
  "tests/production-plan-measurement-postgres-target.test.mjs",
  "tests/production-plan-measurement-rejection-recovery.test.mjs",
  "tests/production-plan-measurement-source.test.mjs",
  "tests/production-plan-measurement-store.test.mjs",
  "tests/production-plan-measurement-view.test.mjs",
  "tests/production-whatsapp-feedback-workspace-ci.test.mjs"
]);
export const PLAN_MEASUREMENT_CURRENT_COMPACT=Object.freeze({previousSourceCount:125,previousSourcePathsSha256:'c2c70c698ccdad8212b9eb4e9fc67f7956fe087a5f853f45a22bcea30586c28f',sourceCount:127,sourcePathsSha256:'62cbd74c5eb900695b98ac79981ec3b841236a1a23f260d1fb8e2d9df1dba305',historicalSourceCount:117,historicalSourcePathsSha256:'92174530d96258515bb501e75c27f64a338af05f919a6f6c8226980f948d1fd8'});
export const PLAN_MEASUREMENT_CURRENT_LEGACY_PRODUCERS=Object.freeze([
 {path:'scripts/verify-plan-import-boundary.mjs',previousSha256:'aa6165858ed1a5cbd38c6d45c339640ac6f87f5bce7467967b30706d13f17f98',sha256:'86518c0dda14a18d04bf20c393f32014ba7af11e76fe507b5999c4ec25d4cd84'},
 {path:'scripts/verify-workspace-plan-recovery-ui.mjs',previousSha256:'cc11d3c9d598676f403276e7b8ed505d7caefaf18a81c5db012f37540c091ee1',sha256:'9835f6f8af3a3d81bc770aa611bcf9233324a7ff196d63f4a1c9194c5b931f51'},
]);
// BEGIN AUDITED I RETENTION PRODUCER REVISION
// Restored text is historical producer evidence, never a current source shim.
export const PLAN_MEASUREMENT_CURRENT_RETENTION_PATCHES=Object.freeze([
  {
    "before": " assert.equal(posts.length,beforePosts,'Recovery navigation must never send a command');\n}\n",
    "after": " assert.equal(posts.length,beforePosts,'Recovery navigation must never send a command');\n}\nasync function closeRetainedUncertainReview(page,posts){\n const references=await browserReferences(page),beforePosts=posts.length;\n await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());\n await page.waitForFunction(()=>document.querySelector('#plan-import-title')?.tagName==='BUTTON'&&[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar')?.disabled===true);\n assert.deepEqual(await browserReferences(page),references,'Closing retains every exact durable reference');\n const link=await page.$('nav[aria-labelledby=\"workspace-tools-title\"] [role=\"status\"] a[href=\"#plan-import-title\"]');assert.ok(link,'A closed uncertain import still names its blocking panel');\n await link.focus();await page.keyboard.press('Enter');\n await page.waitForFunction(()=>document.activeElement?.id==='plan-import-title'&&location.hash==='#plan-import-title');\n assert.equal(await page.$eval('#plan-import-title',element=>element.tagName),'BUTTON','The closed import destination remains actionable');\n assert.equal(posts.length,beforePosts,'Closing and its blocking navigation never send or retry a command');\n}\n"
  },
  {
    "before": "  await page.waitForFunction(()=>document.querySelector('[data-plan-import] input[type=file]')&&!document.querySelector('[data-plan-import] input[type=file]').disabled);assert.deepEqual(await browserReferences(page),[]);assert.equal(posts.length,1);assert.equal(workspaceQueries,readsBeforeExpiry,'Expiry never claims APPLY or refreshes canonical tasks');await assertCount(page,150);\n  assert.equal(await page.$eval('[data-plan-import] input[type=file]',input=>input.value),'');assert.equal(await page.$eval('[data-plan-import] input[type=checkbox]',input=>input.checked),false);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.find(button=>button.textContent==='Extraer borrador').disabled),true);\n  await (await page.$('[data-plan-import] input[type=file]')).uploadFile(sourceFile);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.find(button=>button.textContent==='Extraer borrador').disabled),true);await page.click('[data-plan-import] input[type=checkbox]');await click(page,'Extraer borrador');await waitText(page,'Compará cada fila con el archivo');assert.equal(posts.length,2);assert.notEqual(posts[0].operationId,posts[1].operationId);assert.deepEqual(await browserReferences(page),[]);await assertCount(page,150);\n",
    "after": "  await page.waitForFunction(()=>document.querySelector('[data-plan-import] input[type=file]')&&!document.querySelector('[data-plan-import] input[type=file]').disabled);assert.deepEqual(await browserReferences(page),[]);assert.equal(posts.length,1);assert.equal(workspaceQueries,readsBeforeExpiry,'Expiry never claims APPLY or refreshes canonical tasks');await assertCount(page,150);\n   assert.equal(await page.$eval('[data-plan-import] input[type=file]',input=>input.value),'');assert.equal(await page.$eval('[data-plan-import] input[type=checkbox]',input=>input.checked),false);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.find(button=>button.textContent==='Extraer borrador').disabled),true);\n  await (await page.$('[data-plan-import] input[type=file]')).uploadFile(sourceFile);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.find(button=>button.textContent==='Extraer borrador').disabled),true);await page.click('[data-plan-import] input[type=checkbox]');await click(page,'Extraer borrador');await waitText(page,'Compará cada fila con el archivo');assert.equal(posts.length,2);assert.notEqual(posts[0].operationId,posts[1].operationId);assert.deepEqual(await browserReferences(page),[]);await assertCount(page,150);\n"
  },
  {
    "before": "  await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');await page.waitForFunction(()=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent==='Reintentar los mismos datos'&&!button.disabled));assert.equal(posts.length,1);\n  await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar')?.disabled===false);assert.deepEqual(await browserReferences(page),[reference]);\n  await click(page,'Importar PDF, imagen o Excel');await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);assert.equal(await page.$('[data-plan-import] input[type=file]'),null);\n  await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await click(page,'Cambiar contexto del ensayo');await waitText(page,'Empresa del contexto B');await openProject(page,projectB);await assertCount(page,7,7);assert.ok(!await page.evaluate(id=>document.body.innerText.includes(id),reference.operationId));assert.deepEqual(await browserReferences(page),[reference]);\n  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);assert.equal(posts.length,1);assert.deepEqual(await browserReferences(page),[reference]);\n  checks.push({mode,width,posts:posts.length,recoveryReads:recoveryReads.length,durableJournal:true,ramDiscardedOnClose:true});await context.close();return;\n }\n",
    "after": "  await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');await page.waitForFunction(()=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent==='Reintentar los mismos datos'&&!button.disabled));assert.equal(posts.length,1);\n   await page.evaluate(()=>{const button=[...document.querySelectorAll('[data-plan-import] button')].find(value=>value.textContent==='Reintentar los mismos datos'),key=Object.keys(button).find(value=>value.startsWith('__reactProps$'));if(typeof button[key]?.onClick!=='function')throw Error('Actual retry callback missing');window.closedPlanPreviousRetry=button[key].onClick;});\n   await closeRetainedUncertainReview(page,posts);assert.deepEqual(await browserReferences(page),[reference]);assert.equal(await page.$eval('[data-plan-import]',element=>element.textContent.includes('synthetic-schedule.pdf')),true,'The uncertain File stays in this mounted page');await page.evaluate(()=>window.closedPlanPreviousRetry());assert.equal(posts.length,1,'The callback authorized before closing cannot retry while closed');\n   await click(page,'Importar PDF, imagen o Excel');await waitText(page,'Intento pendiente de comprobación');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false,'Reopening never reuses a previous retry authorization');assert.equal(posts.length,1);const readsBeforeReopenCheck=recoveryReads.length;await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');await page.waitForFunction(()=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent==='Reintentar los mismos datos'&&!button.disabled));assert.equal(recoveryReads.length,readsBeforeReopenCheck+1);assert.equal(recoveryReads.at(-1),reference.operationId,'Only a fresh GET of the exact same UUID can authorize the preserved RAM snapshot');await page.evaluate(()=>window.closedPlanPreviousRetry());assert.equal(posts.length,1,'A stale callback cannot spend the new retry authorization');assert.equal(await page.$('[data-plan-import] input[type=file]'),null);\n   await closeRetainedUncertainReview(page,posts);await click(page,'Cambiar contexto del ensayo');await waitText(page,'Empresa del contexto B');await openProject(page,projectB);await assertCount(page,7,7);assert.ok(!await page.evaluate(id=>document.body.innerText.includes(id),reference.operationId));assert.deepEqual(await browserReferences(page),[reference]);\n  await page.reload({waitUntil:'networkidle0'});await waitText(page,'Empresa sintética de cronogramas');await openProject(page);await click(page,'Comprobar resultado');await waitText(page,'Esto no confirma que el envío se haya perdido');assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false);assert.equal(posts.length,1);assert.deepEqual(await browserReferences(page),[reference]);\n   checks.push({mode,width,posts:posts.length,recoveryReads:recoveryReads.length,durableJournal:true,ramDiscardedOnClose:false,ramRetainedOnClose:true,contextBlockedWhileClosed:true,reopenRequiresExactOperationGET:true,staleRetryCallbackBlocked:true});await context.close();return;\n }\n"
  },
  {
    "before": "  if(legacyConflict){await page.evaluate(({scope,projectId,operationId})=>{sessionStorage.setItem('obrasaas-plan-attempt-v1:'+scope+':'+projectId,JSON.stringify({scope,projectId,operationId,kind:'UPLOAD'}));window.dispatchEvent(new Event('focus'));},{scope,projectId,operationId:legacyId});await waitText(page,'Hay un envío anterior sin confirmar');}\n  if(mode!=='global-same-mount'){await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());await page.waitForFunction(()=>![...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent==='Comprobar resultado'));await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar')?.disabled===false);}\n  resolved=true;await click(page,'Comprobar recibo');\n",
    "after": "  if(legacyConflict){await page.evaluate(({scope,projectId,operationId})=>{sessionStorage.setItem('obrasaas-plan-attempt-v1:'+scope+':'+projectId,JSON.stringify({scope,projectId,operationId,kind:'UPLOAD'}));window.dispatchEvent(new Event('focus'));},{scope,projectId,operationId:legacyId});await waitText(page,'Hay un envío anterior sin confirmar');}\n   if(mode!=='global-same-mount'){await closeRetainedUncertainReview(page,posts);await page.waitForFunction(()=>![...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent==='Comprobar resultado'));}\n  resolved=true;await click(page,'Comprobar recibo');\n"
  },
  {
    "before": "  if(draft){await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent.includes('· 2026-10-06')).click());await waitText(page,'La consulta no repite la IA ni resuelve el intento pendiente');assert.deepEqual(await browserReferences(page),[reference]);}\n  await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent==='Cerrar').click());\n  await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='Actualizar')?.disabled===false);assert.deepEqual(await browserReferences(page),[reference]);\n  await click(page,'Importar PDF, imagen o Excel');await waitText(page,'Intento pendiente de comprobación');assert.equal(await page.$('[data-plan-import] input[type=file]'),null);assert.equal(posts.length,expectedPosts);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false,'Closing discards the RAM command while retaining its durable GET reference');\n  if(mode==='decision-context-409'){\n",
    "after": "  if(draft){await page.evaluate(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent.includes('· 2026-10-06')).click());await waitText(page,'La consulta no repite la IA ni resuelve el intento pendiente');assert.deepEqual(await browserReferences(page),[reference]);}\n   await closeRetainedUncertainReview(page,posts);assert.deepEqual(await browserReferences(page),[reference]);\n   await click(page,'Importar PDF, imagen o Excel');await waitText(page,'Intento pendiente de comprobación');assert.equal(await page.$('[data-plan-import] input[type=file]'),null);assert.equal(posts.length,expectedPosts);assert.equal(await page.$$eval('[data-plan-import] button',buttons=>buttons.some(button=>button.textContent==='Reintentar los mismos datos')),false,'Closing resets retry authorization; a reload retains only its durable GET reference');\n  if(mode==='decision-context-409'){\n"
  }
].map(patch=>Object.freeze(patch)));
export const PLAN_MEASUREMENT_CURRENT_RETENTION_REVISION=Object.freeze({
  "version": "plan-import-recovery-retention-producer-v1",
  "referenceHead": "47ae04ff96420b0b2f118c932553dcdf27bf5d02",
  "producer": "scripts/verify-workspace-plan-recovery-ui.mjs",
  "previousSha256": "9835f6f8af3a3d81bc770aa611bcf9233324a7ff196d63f4a1c9194c5b931f51",
  "currentSha256": "9978062c966ed599d6d65783813169da48b6fd39fdc65ea6691144598f8c3413",
  "sourcePatchesSha256": "9754616e39e829847a91a4e82c7fe1d7c90158737e9e59bad9effb54ecc2a886"
});
// END AUDITED I RETENTION PRODUCER REVISION
const sha=value=>createHash('sha256').update(value).digest('hex'),digest=value=>sha(JSON.stringify(value)),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function deny(message){throw Object.assign(new Error(message),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});}
function requireLineage(condition,message){if(!condition)deny(message);}
function same(actual,expected,message){requireLineage(JSON.stringify(actual)===JSON.stringify(expected),message);}
function exactKeys(value,keys,message){requireLineage(plain(value),message);same(Object.keys(value).sort(),[...keys].sort(),message);}
function bytes(readSource,file){requireLineage(typeof readSource==='function','Committed source resolver required');const value=readSource(file);requireLineage(Buffer.isBuffer(value),'Missing committed source: '+file);return value;}
function lfSha(readSource,file){const value=bytes(readSource,file),text=value.toString('utf8');requireLineage(value.equals(Buffer.from(text)),'Invalid current source encoding: '+file);return sha(text.replaceAll('\r\n','\n'));}
// Validate a producer's published history only. Current validation hashes and
// native manifests must continue to use readSource's unmodified raw bytes.
export function restorePlanMeasurementPublishedGProducerText(section,producer,value){
 validatePlanMeasurementCurrentSection(section);
 const prior=PLAN_MEASUREMENT_CURRENT_LEGACY_PRODUCERS.find(ref=>ref.path===producer);
 requireLineage(Boolean(prior)&&Buffer.isBuffer(value),'Only a reviewed legacy producer can be restored');
 const decoded=value.toString('utf8');requireLineage(value.equals(Buffer.from(decoded)),'Invalid legacy producer encoding');let text=decoded.replaceAll('\r\n','\n');
 const revision=section.planImportRecoveryRetentionRevision;
 if(revision&&producer===revision.producer){
  requireLineage(sha(text)===revision.currentSha256,'The I producer differs from its audited current source');
  requireLineage(digest(PLAN_MEASUREMENT_CURRENT_RETENTION_PATCHES)===revision.sourcePatchesSha256,'Only the exact audited I literal blocks can be restored');
  for(const patch of PLAN_MEASUREMENT_CURRENT_RETENTION_PATCHES){requireLineage(text.split(patch.after).length===2,'Each audited I source block must occur exactly once');text=text.replace(patch.after,()=>patch.before);}
 }
 requireLineage(sha(text)===prior.sha256,'The complete restored G producer body must remain exact');return text;
}
export function planMeasurementCurrentDependencies(kind){return PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES.find(row=>row.kind===kind)?.sourceAdditions||[];}
// Metadata only: no source bytes, native manifests or observed receipts are
// projected. Historical checkers see the exact published H metadata again.
export function publishedHProofMetadata(spec){
 const delta=PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES.find(row=>row.id===spec?.id);if(!delta)return spec;
 requireLineage(spec.kind===delta.kind,'Current proof identity changed');
 if(spec.sourceFiles?.length===delta.previousSourceCount&&digest(spec.sourceFiles)===delta.previousSourcePathsSha256&&spec.producerSha256===delta.previousProducerSha256)return spec;
 requireLineage(Array.isArray(spec.sourceFiles)&&spec.sourceFiles.length===delta.currentSourceCount&&digest(spec.sourceFiles)===delta.currentSourcePathsSha256&&spec.producerSha256===delta.currentProducerSha256,'Current source set or producer differs from the reviewed exact delta: '+delta.id);
 for(const file of delta.sourceAdditions)requireLineage(spec.sourceFiles.filter(value=>value===file).length===1,'Current dependency omitted: '+file);
 const previous=spec.sourceFiles.filter(file=>!delta.sourceAdditions.includes(file));requireLineage(previous.length===delta.previousSourceCount&&digest(previous)===delta.previousSourcePathsSha256,'Published source set changed: '+delta.id);
 return {...spec,sourceFiles:previous,...(delta.allowedFields.includes('producerSha256')?{producerSha256:delta.previousProducerSha256}:{})};
}
export function validatePlanMeasurementCurrentSection(section){
 requireLineage(plain(section),'Current measurement lineage section required');const hasRetentionRevision=Object.hasOwn(section,'planImportRecoveryRetentionRevision');
 exactKeys(section,['version','referenceHead','referencePublicationVerified','previousContractSha256','publishedKycSectionSha256','currentProofChanges','nativeCompact','legacyProducerSources','currentValidationSources',...(hasRetentionRevision?['planImportRecoveryRetentionRevision']:[])],'Current measurement lineage section required');
 if(hasRetentionRevision){exactKeys(section.planImportRecoveryRetentionRevision,Object.keys(PLAN_MEASUREMENT_CURRENT_RETENTION_REVISION),'Exact I producer revision shape required');same(section.planImportRecoveryRetentionRevision,PLAN_MEASUREMENT_CURRENT_RETENTION_REVISION,'Only the reviewed I producer revision may differ from G');}
 requireLineage(section.version===PLAN_MEASUREMENT_CURRENT_CI_VERSION&&section.referenceHead==='cade7e09907f188222a709e79d632ef015a911bd'&&typeof section.referencePublicationVerified==='boolean'&&section.previousContractSha256===PLAN_MEASUREMENT_PUBLISHED_H_CONTRACT_SHA256&&section.publishedKycSectionSha256===PLAN_MEASUREMENT_PUBLISHED_H_KYC_SHA256,'Published H source reference changed');
 same(section.currentProofChanges,PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES,'Only the twelve reviewed CURRENT source fields and two producer fields may change');same(section.nativeCompact,PLAN_MEASUREMENT_CURRENT_COMPACT,'Current127 must remain separate from published125 and historical117');same(section.legacyProducerSources,PLAN_MEASUREMENT_CURRENT_LEGACY_PRODUCERS,'Only exact source literals may extend legacy producers');
 requireLineage(Array.isArray(section.currentValidationSources)&&section.currentValidationSources.length>=4,'Current validation source pins required');const found=new Set();for(const ref of section.currentValidationSources){exactKeys(ref,['path','sha256'],'Invalid current validation pin');requireLineage(typeof ref.path==='string'&&/^(?:src|scripts|tests|\.github)\//.test(ref.path)&&!ref.path.includes('\\')&&!ref.path.includes('..')&&hash(ref.sha256)&&!found.has(ref.path),'Unique safe current validation source pin required');found.add(ref.path);}
 same(section.currentValidationSources.map(ref=>ref.path),PLAN_MEASUREMENT_CURRENT_VALIDATION_PATHS,'Every reviewed current validation source remains required');
 const recoveryPin=section.currentValidationSources.find(ref=>ref.path===PLAN_MEASUREMENT_CURRENT_RETENTION_REVISION.producer),previousRecovery=PLAN_MEASUREMENT_CURRENT_LEGACY_PRODUCERS.find(ref=>ref.path===PLAN_MEASUREMENT_CURRENT_RETENTION_REVISION.producer);
 requireLineage(recoveryPin.sha256===(hasRetentionRevision?PLAN_MEASUREMENT_CURRENT_RETENTION_REVISION.currentSha256:previousRecovery.sha256),'A changed recovery producer requires its explicit I revision and exact current pin');
 for(const file of [PLAN_MEASUREMENT_CURRENT_CI_HELPER,PLAN_MEASUREMENT_CURRENT_CI_TEST,'scripts/verify-company-kyc-outbound-compact-ci.mjs','tests/production-kyc-reply-feedback-current-lineage.test.mjs'])requireLineage(found.has(file),'Current validator source omitted: '+file);return section;
}
export function publishedHContractMetadata(contract){
 requireLineage(plain(contract),'Current workspace contract required');const section=validatePlanMeasurementCurrentSection(contract.planMeasurementCurrentLineage);
 requireLineage(plain(contract.kycExpiredCurrentComposition),'Published H section required');
 requireLineage(digest(contract.kycExpiredCurrentComposition)===PLAN_MEASUREMENT_PUBLISHED_H_KYC_SHA256,'Every published H125/117 source and guard pin must remain unchanged');
 const previous=structuredClone(contract);delete previous.planMeasurementCurrentLineage;
 requireLineage(Array.isArray(previous.extension?.proofs)&&previous.extension.proofs.length===18,'Every existing workspace proof remains required');
 for(const delta of PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES){const matches=previous.extension.proofs.filter(spec=>spec.id===delta.id);requireLineage(matches.length===1,'Exactly one allowed current proof required: '+delta.id);const spec=matches[0];requireLineage(spec.sourceFiles?.length===delta.currentSourceCount&&digest(spec.sourceFiles)===delta.currentSourcePathsSha256&&spec.producerSha256===delta.currentProducerSha256,'Current proof cannot fall back to published source bytes: '+delta.id);const restored=publishedHProofMetadata(spec);spec.sourceFiles=restored.sourceFiles;if(delta.allowedFields.includes('producerSha256'))spec.producerSha256=restored.producerSha256;}
 return previous;
}
export function reconstructPublishedHContract(contract){
 const previous=publishedHContractMetadata(contract);
 requireLineage(sha(JSON.stringify(previous,null,2)+'\n')===contract.planMeasurementCurrentLineage.previousContractSha256,'An unapproved field differs from the complete published H contract');validateKycExpiredCurrentWorkspaceContract(previous);return previous;
}
export function validatePlanMeasurementCompactSourceLineage(files){
 requireLineage(Array.isArray(files)&&new Set(files).size===files.length,'Unique current compact source paths required');same(files,[...files].sort(),'Ordered current compact paths required');requireLineage(files.length===127&&digest(files)===PLAN_MEASUREMENT_CURRENT_COMPACT.sourcePathsSha256,'Exact actual G127 source closure required');
 for(const file of PLAN_MEASUREMENT_CURRENT_SOURCES)requireLineage(files.filter(value=>value===file).length===1,'Current compact source dependency omitted: '+file);
 const published=files.filter(file=>!PLAN_MEASUREMENT_CURRENT_SOURCES.includes(file));requireLineage(published.length===125&&digest(published)===PLAN_MEASUREMENT_CURRENT_COMPACT.previousSourcePathsSha256,'G127 must retain every H125 path');const historical=published.filter(file=>!KYC_EXPIRED_CURRENT_ADDITIONS.includes(file));requireLineage(historical.length===117&&digest(historical)===PLAN_MEASUREMENT_CURRENT_COMPACT.historicalSourcePathsSha256,'Original117 must remain immutable');return files;
}
export function verifyPlanMeasurementCurrentSources(contract,readSource){
 const prior=reconstructPublishedHContract(contract),section=contract.planMeasurementCurrentLineage;
 validatePlanMeasurementCompactSourceLineage(kycExpiredCurrentSourceFiles(readSource));
 for(const ref of [...KYC_EXPIRED_CURRENT_REVIEWED_SOURCES,...section.currentValidationSources])requireLineage(lfSha(readSource,ref.path)===ref.sha256,'Stale current source bytes: '+ref.path);
 for(const ref of section.legacyProducerSources)requireLineage(sha(restorePlanMeasurementPublishedGProducerText(section,ref.path,bytes(readSource,ref.path)))===ref.sha256,'A published G producer body changed: '+ref.path);
 for(const delta of PLAN_MEASUREMENT_CURRENT_PROOF_CHANGES){const spec=contract.extension.proofs.find(row=>row.id===delta.id);requireLineage(lfSha(readSource,spec.producer)===delta.currentProducerSha256,'Current producer is not the reviewed Git source: '+delta.id);}
 return {version:PLAN_MEASUREMENT_CURRENT_CI_VERSION,publishedContractSha256:sha(JSON.stringify(prior,null,2)+'\n'),sourceCount:127,previousSourceCount:125,historicalSourceCount:117,sourcePathsSha256:section.nativeCompact.sourcePathsSha256,sourceAdditions:[...PLAN_MEASUREMENT_CURRENT_SOURCES]};
}
export function validatePlanMeasurementCurrentCompactReceipt(proof,contract,readSource){
 const lineage=verifyPlanMeasurementCurrentSources(contract,readSource),h=contract.kycExpiredCurrentComposition;
 requireLineage(proof?.checks?.length===13&&digest(proof.checks)===h.historicalChecksSha256,'Every original13 native check required');same(proof.scenarios?.map(row=>row?.name),h.historicalScenarios,'Every original13 scenario required');same(proof.measurements?.map(row=>row?.kind),h.historicalMeasurements,'Every original3 measurement required');same(proof.scenarios.map(row=>row.providerPosts),[1,1,1,0,0,0,0,0,0,0,1,0,0],'Historical four POSTs require their unchanged per-scenario accounting');
 const prior=proof.contextFeedbackNative,current=proof.latestExpiredContextNative;same(prior?.checks,h.priorContextChecks,'Prior context observation cannot replace current context');same(current?.checks,h.composedCurrentChecks,'Current production composition observation required');requireLineage(proof.syntheticMessagePostCount===4&&proof.totalSyntheticMessagePostCount===6&&prior.measurement.providerPosts===1&&current.measurement.providerPosts===1&&prior.measurement.replayedPosts===0&&current.measurement.replayedPosts===0,'Original four plus two independent one-POST contexts required');
 for(const context of [prior,current])requireLineage(context.consentChosen===false&&context.identitySubmitted===false&&context.privateMediaCalls===0&&context.realProviderCalls===0&&context.productionDataTouched===false&&context.humanAccepted===false&&context.measurement.sourceLeaseMs===60000&&context.measurement.leaseExtended===false&&context.measurement.statementDelayMs===225&&context.measurement.graphDelayMs===200,'Current sources cannot weaken the original lease, controlled latency or certify private/real acceptance');
 requireLineage(current.compositionFactory===h.compositionFactory&&current.quotedLatestPrompt===true&&current.fixtureConversationExpired===true&&current.challengeStillValid===true&&current.challengeStatus==='CLAIMED'&&current.measurement.beforeDispatchReads===1&&current.measurement.sourceLeaseWrites===1&&current.measurement.workerWrites===0,'Actual unchanged production composition and source claim required');same(current.calls,{rejectionRecovery:1,expiryRecovery:1,contextRecovery:1,contextPredispatch:1,intake:0,capture:0,app:0,company:0,field:0,expiryFallback:0,authorizationDefer:0},'Current context needs every canonical recovery and zero alternate execution');
 const manifest=proof.sourceManifest;requireLineage(Array.isArray(manifest)&&manifest.length===127,'Actual current127 native source manifest required');validatePlanMeasurementCompactSourceLineage(manifest.map(ref=>ref?.path).sort());for(const ref of manifest){exactKeys(ref,['path','sha256'],'Invalid actual current native source reference');requireLineage(hash(ref.sha256)&&sha(bytes(readSource,ref.path))===ref.sha256,'Native current proof must match every committed G source byte: '+ref.path);}
 return {...lineage,historicalChecksSha256:h.historicalChecksSha256,historicalPostCount:4,priorContextPostCount:1,composedCurrentPostCount:1,totalPostCount:6,nativeManifestSha256:digest(manifest),publishedKycSectionSha256:PLAN_MEASUREMENT_PUBLISHED_H_KYC_SHA256,validationSourceManifest:['.github/workspace-acceptance-contract.json',...contract.planMeasurementCurrentLineage.currentValidationSources.map(ref=>ref.path)].map(file=>({path:file,sha256:sha(bytes(readSource,file))}))};
}
