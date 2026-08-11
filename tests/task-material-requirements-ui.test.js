import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyTaskMaterialHistoryPage,
  validateTaskMaterialCatalogResponse,
} from "../src/lib/task-material-requirements-ui-contract.js";

const root = new URL("../", import.meta.url);
const [page, purchasesClient, client, css, reservationPanel] = await Promise.all([
  readFile(new URL("src/app/dashboard/purchases/page.js", root), "utf8"),
  readFile(new URL("src/app/dashboard/purchases/purchases-client.js", root), "utf8"),
  readFile(new URL("src/app/dashboard/purchases/task-material-requirements-client.js", root), "utf8"),
  readFile(new URL("src/app/dashboard/purchases/task-material-requirements-client.module.css", root), "utf8"),
  readFile(new URL("src/app/dashboard/purchases/task-material-reservations-panel.js", root), "utf8"),
]);

test("server catalog requires task and inventory permissions and fails closed at its cap", () => {
  assert.match(page, /hasTenantPermission\(access, "org:tasks:read"\)[\s\S]*&& hasTenantPermission\(access, "org:inventory:read"\)/);
  assert.match(page, /hasTenantPermission\(access, "org:tasks:manage"\)[\s\S]*&& hasTenantPermission\(access, "org:inventory:manage"\)/);
  assert.match(page, /metadata: \{ path: \["source"\], equals: "canonical-task-v1" \}/);
  assert.match(page, /select: \{[\s\S]*id: true,[\s\S]*type: true,[\s\S]*revision: true/);
  assert.match(page, /take: 5_001/);
  assert.match(page, /materialTasksTruncated=\{materialTasks\.length > 5_000\}/);
  assert.match(page, /id: task\.id,[\s\S]*code: task\.code,[\s\S]*type: task\.type,[\s\S]*revision: task\.revision/);
  assert.match(client, /tasksTruncated && \(/);
  assert.match(client, /Hay más de 5\.000 tareas canónicas/);
});

test("purchases wires the isolated client with separate read and manage capabilities", () => {
  assert.match(purchasesClient, /import TaskMaterialRequirementsClient/);
  assert.match(purchasesClient, /\{canReadTaskMaterials && \(/);
  assert.match(purchasesClient, /tasks=\{materialTasks\}/);
  assert.match(purchasesClient, /tasksTruncated=\{materialTasksTruncated\}/);
  assert.match(purchasesClient, /canManage=\{canManageTaskMaterials\}/);
});

test("opening a task lazily loads its BOM, complete active catalog, and supplier context", () => {
  assert.match(client, /!selectedTaskId \|\| tasksTruncated/);
  assert.match(client, /Promise\.allSettled\(\[/);
  assert.match(client, /\/api\/tasks\/\$\{encodeURIComponent\(selectedTaskId\)\}\/material-requirements\?limit=\$\{HISTORY_PAGE_SIZE\}/);
  assert.match(client, /\/api\/inventory-items\?active=true/);
  assert.match(client, /\/api\/supplier-commitments\?taskId=\$\{encodeURIComponent\(selectedTaskId\)\}/);
  assert.match(client, /commitmentsTruncated/);
});

test("active inventory catalog accepts the real non-cursor response and rejects truncation", () => {
  const item = {
    id: "item-a",
    code: "MAT-001",
    name: "Cemento",
    baseUnit: "bolsa",
    active: true,
  };
  assert.deepEqual(
    validateTaskMaterialCatalogResponse({ items: [item], hasMore: false }),
    [item],
  );
  assert.deepEqual(
    validateTaskMaterialCatalogResponse({ items: [item], hasMore: false, nextCursor: null }),
    [item],
  );
  assert.throws(
    () => validateTaskMaterialCatalogResponse({
      items: [item],
      hasMore: true,
      nextCursor: "partial-catalog",
    }),
    /catálogo activo está incompleto/,
  );
});

test("a late history page cannot cross from one selected task into another", () => {
  const current = {
    task: { id: "task-b" },
    head: { id: "head-b" },
    history: [{ id: "revision-b" }],
    hasMore: true,
    nextCursor: "cursor-b",
  };
  assert.equal(applyTaskMaterialHistoryPage(current, {
    taskId: "task-a",
    expectedHeadId: "head-a",
    history: [{ id: "revision-a" }],
    hasMore: false,
    nextCursor: null,
  }), current);

  assert.deepEqual(applyTaskMaterialHistoryPage(current, {
    taskId: "task-b",
    expectedHeadId: "head-b",
    history: [{ id: "revision-b" }, { id: "revision-b-older" }],
    hasMore: false,
    nextCursor: null,
  }), {
    ...current,
    history: [{ id: "revision-b" }, { id: "revision-b-older" }],
    hasMore: false,
    nextCursor: null,
  });
});

test("publication preserves exact decimal strings and authoritative optimistic concurrency", () => {
  assert.match(client, /type="text"/);
  assert.match(client, /inputMode="decimal"/);
  assert.match(client, /pattern="\[0-9\]\+\(\[\.\]\[0-9\]\{1,3\}\)\?"/);
  assert.match(client, /quantity: line\.quantity/);
  assert.match(client, /expectedActiveRevisionId: snapshot\.head\?\.id \|\| null/);
  assert.doesNotMatch(client, /parseFloat|parseInt|Number\(/);
  assert.doesNotMatch(client, /organizationId|projectId|actorId/);
  assert.match(client, /const authoritativeTask = snapshot\?\.task \|\| selectedTask/);
  assert.match(client, /authoritativeTask\?\.type !== "TASK"/);
  assert.match(client, /revision\.predecessorId !== payload\.expectedActiveRevisionId/);
});

test("idempotency key remains stable until a validated successful response", () => {
  assert.match(client, /publishAttemptRef\.current\?\.payloadKey !== payloadKey/);
  assert.match(client, /publishAttemptRef\.current = \{ payloadKey, operationKey: crypto\.randomUUID\(\) \}/);
  assert.match(client, /"Idempotency-Key": publishAttemptRef\.current\.operationKey/);
  const clearIndex = client.indexOf("publishAttemptRef.current = null;", client.indexOf("async function publish"));
  const successIndex = client.indexOf("const revision = validateRevision", client.indexOf("async function publish"));
  const catchIndex = client.indexOf("} catch (error) {", client.indexOf("async function publish"));
  assert.ok(clearIndex > successIndex && clearIndex < catchIndex);
  assert.match(client, /No se reintentó automáticamente/);
  assert.match(client, /reloadTask\(\{ preserveNotice: true, afterConflict: true \}\)/);
  assert.doesNotMatch(client, /catch \(error\)[\s\S]{0,500}publish\(/);
});

test("no-materials declaration, immutable history, and pagination are explicit", () => {
  assert.match(client, /kind: "NO_MATERIALS_REQUIRED"/);
  assert.match(client, /lines: \[\]/);
  assert.match(client, /Declarar que no requiere materiales/);
  assert.match(client, /Historial inmutable/);
  assert.match(client, /Cargar más/);
  assert.match(client, /cursor=\$\{encodeURIComponent\(snapshot\.nextCursor\)\}/);
  assert.match(client, /historyRequestRef\.current\?\.controller\.abort\(\)/);
  assert.match(client, /historyRequestRef\.current\?\.controller !== controller/);
  assert.match(client, /applyTaskMaterialHistoryPage\(current/);
});

test("supplier links never claim reservation or material availability", () => {
  assert.match(client, /PROMESA, NO RESERVA/);
  assert.match(client, /no asignan stock ni cubren líneas de la BOM/);
  assert.match(client, /Una promesa de proveedor, una foto o una inferencia de IA nunca asignan existencias/);
  assert.match(client, /RESERVA CONTROLADA/);
  assert.match(client, /reserva completa contra stock/);
});

test("reservation UI separates publish eligibility from compensating release authority", () => {
  assert.match(client, /canReserve=\{canManage && taskCanPublish\}/);
  assert.match(client, /canRelease=\{canManage\}/);
  assert.match(reservationPanel, /snapshot\.readiness\.state === "DEFINED_UNRESERVED" && canReserve/);
  assert.match(
    reservationPanel,
    /snapshot\.reservationHead\?\.kind === "RESERVE"[\s\S]*&& canRelease/,
  );
  assert.match(reservationPanel, /snapshot\.readiness\.state !== "AVAILABLE"/);
  assert.match(reservationPanel, /liberarla completa para recuperar el stock/);
});

test("reservation mutations fail closed across reloads, task switches, replays, and unmounts", () => {
  assert.match(client, /const reservationBusyRef = useRef\(false\)/);
  assert.match(client, /\|\| reservationBusyRef\.current[\s\S]*\|\| taskId === selectedTaskId/);
  assert.match(client, /disabled=\{loadState === "loading" \|\| publishBusy \|\| reservationBusy\}/);
  assert.match(client, /\{authoritativeTask\?\.type === "TASK" && \([\s\S]*<TaskMaterialReservationsPanel/);
  assert.match(reservationPanel, /publishState\(null, false\);[\s\S]*onBusyChange\?\.\(taskId, true\)/);
  assert.match(reservationPanel, /if \(result\.readiness\.authoritative\)[\s\S]*else \{[\s\S]*publishState\(null, false\)/);
  assert.match(reservationPanel, /mountedRef\.current = true;[\s\S]*mountedRef\.current = false/);
  assert.match(reservationPanel, /if \(!mountedRef\.current\) return;/);
  assert.doesNotMatch(reservationPanel, /controller\.abort\(\)[\s\S]{0,300}method: "POST"/);
});

test("the task catalog paginates all received tasks and collapses safely on mobile", () => {
  assert.match(client, /const TASK_PAGE_SIZE = 100/);
  assert.match(client, /filteredTasks\.slice\(/);
  assert.match(client, /aria-live="polite"/);
  assert.match(client, /role="alert"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.workspace,[\s\S]*\.lineCard \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /width: 100%/);
});
