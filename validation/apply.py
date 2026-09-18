"""Apply candidate changes to an exact clean checkout; never commit or deploy."""
import json, sys, subprocess, hashlib
from pathlib import Path
root=Path(sys.argv[1]).resolve()
here=Path(__file__).resolve().parent
BASE='e9b19c2bd20642a40c88d8d69c56781dc66e0f4b'
def git(*args):return subprocess.check_output(['git','-C',str(root),*args],text=True).strip()
if git('rev-parse','HEAD')!=BASE or git('status','--porcelain'):raise RuntimeError('Expected exact clean base')
checks={
 'src/app/dashboard/progress/progress-client.js':'995d066240b54c463f4ec2dee8b98fb78fb2cfbc',
 'src/app/api/progress/[recordId]/route.js':'7392693cbefdf0992874b4ed9583260f3d898594',
 'src/lib/evidence-context.js':'13198027a74062c08e6fdbcab948244d7abd0668',
 'src/lib/evidence-capture-policy.js':'3716507c5455526ba55ae5eabc424b31f070aa6e',
 'tests/progress-review-authorization.test.js':'a28fe861cf9c8883ea3721ddf38f967ce601c555',
}
original={}
for name,expected in checks.items():
 raw=(root/name).read_bytes()
 actual=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
 if actual!=expected:raise RuntimeError('Source changed: '+name)
 original[name]=raw.decode()
def replace(text,before,after):
 if text.count(before)!=1:raise RuntimeError('Patch anchor mismatch: '+before[:90])
 return text.replace(before,after,1)
client=original['src/app/dashboard/progress/progress-client.js']
client=replace(client,'import styles from "./progress.module.css";',"import { createProgressRequest, confirmedProgressLog } from '@/lib/progress-request';\nimport ProgressContextPanel from './progress-context-panel';\nimport styles from \"./progress.module.css\";")
start=client.index('async function api(path, options = {}) {')
end=client.index('function createVisualIdempotencyKey()',start)
client=client[:start]+client[end:]
client=replace(client,'  initialWorkDate,\n}) {\n  const [data, setData] = useState(initialData);', '''  initialWorkDate,
}) {
  const [contextChanged, setContextChanged] = useState(false);
  const api = useMemo(
    () => createProgressRequest({ organizationId, projectId }, { onContextChange: () => setContextChanged(true) }),
    [organizationId, projectId],
  );
  const [data, setData] = useState(initialData);''')
client=replace(client,'    if (operationRef.current) return false;','    if (operationRef.current || contextChanged) return false;')
client=replace(client,'      setData((current) => ({\n        ...current,\n        dailyLogs: [result.dailyLog, ...current.dailyLogs],\n      }));', '''      const dailyLog = confirmedProgressLog(result);
      setData((current) => ({
        ...current,
        dailyLogs: [dailyLog, ...current.dailyLogs.filter(item => item.id !== dailyLog.id)],
      }));''')
client=replace(client,"    } catch (error) {\n      if (attempt?.uploadId", "    } catch (error) {\n      if (error.code === 'EVIDENCE_CONTEXT_CHANGED') setContextChanged(true);\n      if (attempt?.uploadId")
client=replace(client,'    } catch (error) {\n      if (error.status === 409) {\n        const refreshed = await refreshPrimaryRecords();', "    } catch (error) {\n      if (error.code === 'EVIDENCE_CONTEXT_CHANGED') {\n        setNotice(error.message);\n      } else if (error.status === 409) {\n        const refreshed = await refreshPrimaryRecords();")
client=replace(client,'      {notice && (', '''      <ProgressContextPanel projectName={projectName} changed={contextChanged} busy={busy}
        hasUnsaved={hasJournalChanges} draftText={[title, summary, caption].filter(Boolean).join('\\n\\n')} />
      {notice && (''')
client=replace(client,'                Guardar borrador\n              </button>','                {busy ? "Guardando…" : contextChanged ? "Verificá la obra activa" : "Guardar borrador"}\n              </button>')
head,tail=client.split('export default function ProgressClient',1)
client=head+'export default function ProgressClient'+tail.replace('disabled={busy}', 'disabled={busy || contextChanged}')
route=original['src/app/api/progress/[recordId]/route.js']
route=replace(route,'import {\n  AccessError,',"import { assertEvidenceRequestContext, evidenceContextErrorResponse } from '@/lib/evidence-context';\nimport {\n  AccessError,")
route=replace(route,'function known(error) {','function known(error) {\n  const contextError = evidenceContextErrorResponse(error);\n  if (contextError) return contextError;')
route=replace(route,'    const access = await getPlatformAccess();','    const access = await getPlatformAccess();\n    assertEvidenceRequestContext(request, access);')
tests=original['tests/progress-review-authorization.test.js']
tests=replace(tests,"import { roleHasPermission } from '../src/lib/tenant-roles.js';","import { roleHasPermission } from '../src/lib/tenant-roles.js';\nimport { assertEvidenceRequestContext, evidenceContextErrorResponse } from '../src/lib/evidence-context.js';")
tests=replace(tests,'    AccessError, RequestBodyError,','    AccessError, RequestBodyError, assertEvidenceRequestContext, evidenceContextErrorResponse,')
changed={'src/app/dashboard/progress/progress-client.js':client,'src/app/api/progress/[recordId]/route.js':route,'tests/progress-review-authorization.test.js':tests}
allowed={'src/lib/progress-request.js','src/app/dashboard/progress/progress-context-panel.js','src/app/dashboard/progress/progress-context-panel.module.css','tests/progress-request-context.test.js','scripts/verify-progress-context-ui.mjs','docs/recovery/progress-context-validation.md'}
found=set()
for path in (here/'new').rglob('*'):
 if not path.is_file():continue
 name=path.relative_to(here/'new').as_posix()
 if name not in allowed or (root/name).exists():raise RuntimeError('Unexpected addition: '+name)
 found.add(name);changed[name]=path.read_text()
if found!=allowed:raise RuntimeError('Incomplete candidate')
for name,text in changed.items():
 p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
(root/'.vercel').mkdir(exist_ok=True)
(root/'.vercel/validation-files.json').write_text(json.dumps(sorted(changed)))
print(json.dumps({'status':'APPLIED_FOR_VALIDATION','base':BASE,'files':sorted(changed)}))
