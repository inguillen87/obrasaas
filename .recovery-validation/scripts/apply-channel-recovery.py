from pathlib import Path
import re, subprocess
root=Path.cwd()
EXPECTED='b189ab5bc54df9a3ab7b6089657b3432b87ff376'
assert subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()==EXPECTED, 'Application base changed'
def replace(name, before, after):
    p=root/name; s=p.read_text(encoding='utf-8')
    assert s.count(before)==1, 'Ambiguous or missing anchor: '+name+' / '+before[:90]
    p.write_text(s.replace(before,after,1),encoding='utf-8')
client='src/app/dashboard/integrations/integrations-client.js'
replace(client,"import WhatsAppConnectExperience from './whatsapp-connect-experience';", "import WhatsAppConnectExperience from './whatsapp-connect-experience';\nimport ChannelRecoveryPanel from './channel-recovery-panel';")
replace(client,'  const [channelHealth, setChannelHealth] = useState(initialHealth);', '  const [channelHealth, setChannelHealth] = useState(initialHealth);\n  const [lifecycleView, setLifecycleView] = useState(null);')
replace(client,'  const graphReady = whatsappGraphAccessReady(connection, channelHealth);', '''  const lifecycleMatches = lifecycleView?.organizationId === organizationId && lifecycleView?.projectId === projectId;
  const lifecycleBlocked = linked && (!lifecycleMatches || lifecycleView.state !== 'ready' || lifecycleView.credential?.blocksProviderActions !== false);
  const lifecycleContextBlocked = linked && lifecycleMatches && lifecycleView.state === 'blocked';
  const lifecycleReauthorization = linked && lifecycleMatches && lifecycleView.credential?.reauthorizationRequired === true;
  const graphReady = whatsappGraphAccessReady(connection, channelHealth) && !lifecycleBlocked;''')
replace(client,'  const reconnectRequired = whatsappReconnectRequired(connection, channelHealth);', '  const reconnectRequired = whatsappReconnectRequired(connection, channelHealth) || lifecycleReauthorization;')
replace(client,'  const healthStateClass = channelHealth?.degraded', '  const healthStateClass = lifecycleBlocked || channelHealth?.degraded')
replace(client,'    setChannelHealth(null);\n    setHealthDiagnostics(null);','    setChannelHealth(null);\n    setLifecycleView(null);\n    setHealthDiagnostics(null);')
replace(client,'    if (internalWorkspace || pending || signupActiveRef.current) return;', '    if (internalWorkspace || pending || lifecycleContextBlocked || signupActiveRef.current) return;')
replace(client,'  async function verifyChannel() {','  async function verifyChannel() {\n    if (lifecycleContextBlocked || healthPending) return;')
replace(client,"            {channelHealth?.label || 'Estado pendiente'}", "            {lifecycleBlocked ? (lifecycleReauthorization ? 'Reautorizar WhatsApp' : 'Estado por verificar') : channelHealth?.label || 'Estado pendiente'}")
replace(client,'        <WhatsAppConnectExperience companyName={companyName}', '''        {linked && !internalWorkspace && <ChannelRecoveryPanel key={organizationId + ':' + projectId}
          organizationId={organizationId} projectId={projectId} refreshKey={healthDiagnostics?.checkedAt || ''}
          busy={pending || healthPending || Boolean(flowPendingKey) || Boolean(templatePendingKey)}
          onStatus={setLifecycleView} onVerify={verifyChannel} />}
        <div id="customer-whatsapp-authorization" tabIndex={-1}>
        <WhatsAppConnectExperience companyName={companyName}''')
replace(client,'blocked={healthPending || Boolean(flowPendingKey)', 'blocked={healthPending || lifecycleContextBlocked || Boolean(flowPendingKey)')
replace(client,'          onConnect={startSignup} diagnostics={healthDiagnostics} canReadInbox={canReadInbox} />','          onConnect={startSignup} diagnostics={healthDiagnostics} canReadInbox={canReadInbox} />\n        </div>')
replace(client,'        {channelHealth && (', '        {channelHealth && !lifecycleBlocked && (')
experience='src/app/dashboard/integrations/whatsapp-connect-experience.js'
replace(experience, "needsConnect ? 'Conectá el WhatsApp de tu empresa'", "needsConnect ? (reconnectRequired ? 'Recuperá el WhatsApp de esta obra' : 'Conectá el WhatsApp de tu empresa')")
replace(experience, '<li data-done={linked}><b>1</b>', '<li data-done={linked && !reconnectRequired}><b>1</b>')
p=root/'tests/proxy-sensitive-route-coverage.test.js'; s=p.read_text(encoding='utf-8')
s,count=re.subn(r'assert\.equal\(protectedRouteCount, (\d+),',lambda m: 'assert.equal(protectedRouteCount, '+str(int(m.group(1))+1)+',',s)
assert count==1, 'Protected route count assertion not found'; p.write_text(s,encoding='utf-8')
print('Bound the recovery view to the existing scoped Meta authorization; no database writes or new messaging actions')
handoff=root/'docs/recovery/HANDOFF_TENANT_WHATSAPP.md'
with handoff.open('a',encoding='utf-8') as out:
    out.write('\n## Continuación S11.A6: vigencia y recuperación del canal\nLeer `whatsapp-credential-recovery.md`. La lectura de vigencia no renueva credenciales ni envía mensajes. El panel aplica aviso/deadline por obra sin perder la preparación y conduce a la autorización existente. Ejecutar `node scripts/verify-channel-recovery-ui.mjs`; usa componentes reales con identidad/HTTP controlados, no consentimiento Meta ni entrega física. Mantener pendientes las pruebas operativas y el pase de Production hasta verificarlos por separado.\n')
