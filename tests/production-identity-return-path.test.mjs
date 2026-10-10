import test from 'node:test';
import assert from 'node:assert/strict';
import { identityInvitationId, identityAccountReturnPath, identitySignInPath, identitySignUpPath, identityHasPendingInvitation, identityWorkspaceProjectHint } from '../src/lib/identity-return-path.mjs';

const invitationId = 'invite_0123456789abcdef0123456789abcdef';
const routes = [identityAccountReturnPath, identitySignInPath, identitySignUpPath];
const paths = ['/cuenta', '/sign-in', '/sign-up'];

test('invitation navigation is identical for resolved Next query objects and URLSearchParams', () => {
  for (const query of [{ participar: invitationId }, new URLSearchParams({ participar: invitationId })]) {
    assert.equal(identityInvitationId(query), invitationId);
    routes.forEach((route, index) => assert.equal(route(query), `${paths[index]}?participar=${invitationId}`));
  }
});

test('missing invitation and untrusted shapes use only fixed local route defaults', () => {
  for (const query of [undefined, null, {}, 'https://foreign.example/cuenta', { participar: 1 }, { participar: { value: invitationId } }, Object.create({ participar: invitationId })]) {
    assert.equal(identityInvitationId(query), '');
    routes.forEach((route, index) => assert.equal(route(query), paths[index]));
  }
});

test('duplicate invitation parameters are rejected even when their values agree', () => {
  for (const query of [
    { participar: [invitationId, invitationId] },
    { participar: [invitationId, 'invite_' + 'f'.repeat(32)] },
    new URLSearchParams(`participar=${invitationId}&participar=${invitationId}`),
    new URLSearchParams(`participar=${invitationId}&participar=`),
  ]) {
    assert.equal(identityInvitationId(query), '');
    routes.forEach((route, index) => assert.equal(route(query), paths[index]));
  }
});

test('a valid invitation cannot carry an external destination, session token or Clerk ticket into navigation', () => {
  const query = new URLSearchParams({ participar: invitationId, redirect_url: 'https://foreign.example', returnTo: '//foreign.example', token: 'synthetic-session-token', __clerk_ticket: 'synthetic-ticket', scope: 'admin' });
  routes.forEach((route, index) => {
    const destination = route(query);
    assert.equal(destination, `${paths[index]}?participar=${invitationId}`);
    const parsed = new URL(destination, 'https://obrasaas.com');
    assert.equal(parsed.origin, 'https://obrasaas.com');
    assert.deepEqual([...parsed.searchParams.keys()], ['participar']);
  });
});

test('URL and delimiter attacks never become invitation identifiers or redirect destinations', () => {
  for (const value of [
    'https://foreign.example', '//foreign.example', '/cuenta', 'javascript:alert(1)',
    invitationId + '&redirect_url=https://foreign.example', invitationId + '#fragment',
    invitationId + '\r\nLocation: https://foreign.example', invitationId + '/../../admin',
    invitationId + '?token=synthetic', invitationId + '\\evil', invitationId + ' ',
    invitationId + '\n', invitationId + '\r', invitationId + '\u2028',
    ' ' + invitationId, invitationId.toUpperCase(), 'invite_' + 'a'.repeat(31),
    'invite_' + 'a'.repeat(33), 'invite_' + 'g'.repeat(32), 'invite%5F' + 'a'.repeat(32),
  ]) {
    routes.forEach((route, index) => assert.equal(route({ participar: value }), paths[index], value));
  }
});

test('normal URL decoding yields a canonical ID but double-encoded identifiers remain rejected', () => {
  assert.equal(identityAccountReturnPath(new URLSearchParams('participar=invite%5F' + 'a'.repeat(32))), '/cuenta?participar=invite_' + 'a'.repeat(32));
  assert.equal(identityAccountReturnPath(new URLSearchParams('participar=invite%255F' + 'a'.repeat(32))), '/cuenta');
});

test('anonymous invitation survives login, switching to signup and selecting an organization without growing query context', () => {
  const account = new URL('https://obrasaas.com/cuenta?participar=' + invitationId);
  const signIn = new URL(identitySignInPath(account.searchParams), account.origin);
  const signUp = new URL(identitySignUpPath(signIn.searchParams), account.origin);
  const afterAuth = new URL(identityAccountReturnPath(signUp.searchParams), account.origin);
  const afterSelection = new URL(identityAccountReturnPath(afterAuth.searchParams), account.origin);
  assert.equal(afterSelection.href, account.href);
  assert.deepEqual([...afterSelection.searchParams.entries()], [['participar', invitationId]]);
});

test('pending Clerk invitations select the original-URL widget for both sign-in and sign-up without forwarding the ticket', () => {
  for (const status of ['sign_in', 'sign_up']) {
    for (const query of [
      { participar: invitationId, __clerk_status: status, __clerk_ticket: 'synthetic.ticket_1-safe' },
      new URLSearchParams({ participar: invitationId, __clerk_status: status, __clerk_ticket: 'synthetic.ticket_1-safe' }),
    ]) {
      assert.equal(identityHasPendingInvitation(query), true);
      assert.equal(identityAccountReturnPath(query), '/cuenta?participar=' + invitationId);
      assert.equal(identitySignInPath(query), '/sign-in?participar=' + invitationId);
    }
  }
});

test('duplicate pending status or ticket cannot select the invitation widget', () => {
  for (const query of [
    { __clerk_status: ['sign_in', 'sign_in'], __clerk_ticket: 'synthetic-ticket' },
    { __clerk_status: 'sign_in', __clerk_ticket: ['synthetic-ticket', 'synthetic-ticket'] },
    new URLSearchParams('__clerk_status=sign_in&__clerk_status=sign_up&__clerk_ticket=synthetic-ticket'),
    new URLSearchParams('__clerk_status=sign_in&__clerk_ticket=synthetic-ticket&__clerk_ticket='),
  ]) assert.equal(identityHasPendingInvitation(query), false);
});

test('ticket presentation is bounded and rejects URLs, delimiters, whitespace and encoded fragments', () => {
  assert.equal(identityHasPendingInvitation({ __clerk_status: 'sign_in', __clerk_ticket: 'a' }), true);
  assert.equal(identityHasPendingInvitation({ __clerk_status: 'sign_up', __clerk_ticket: 'a'.repeat(8192) }), true);
  for (const ticket of ['', 'a'.repeat(8193), 'https://foreign.example/ticket', '//foreign.example', 'javascript:alert(1)', 'ticket?role=admin', 'ticket&role=admin', 'ticket#fragment', 'ticket=token', 'ticket%2Ftoken', 'ticket\n', 'ticket\r', ' ticket', 'ticket ', 'ticket\u2028', 12, null]) {
    assert.equal(identityHasPendingInvitation({ __clerk_status: 'sign_in', __clerk_ticket: ticket }), false);
  }
});

test('complete, missing and attacker-selected status use the normal independently verified account flow', () => {
  for (const status of ['complete', undefined, '', 'SIGN_IN', 'sign_in ', 'https://foreign.example', 'sign_in\n']) {
    assert.equal(identityHasPendingInvitation({ __clerk_status: status, __clerk_ticket: 'synthetic-ticket' }), false);
  }
  assert.equal(identityHasPendingInvitation(new URLSearchParams('redirect_url=https://foreign.example&ticket=synthetic-ticket&status=sign_in')), false);
  assert.equal(identityHasPendingInvitation(Object.create({ __clerk_status: 'sign_in', __clerk_ticket: 'synthetic-ticket' })), false);
});

test('workspace hints reject duplicate, foreign, delimited and inherited project context', () => {
  const projectId = 'project-pilot_20261010';
  for (const query of [{ obra: projectId }, new URLSearchParams({ obra: projectId })]) assert.equal(identityWorkspaceProjectHint(query), projectId);
  for (const query of [
    undefined, null, {}, 'https://foreign.example', { obra: 1 }, { obra: { value: projectId } },
    Object.create({ obra: projectId }), { obra: [projectId, projectId] },
    new URLSearchParams('obra=' + projectId + '&obra=' + projectId),
    ...['', 'a'.repeat(129), '_project', '-project', '//foreign.example', 'https://foreign.example',
      'javascript:alert(1)', projectId + '&role=ADMIN', projectId + '?scope=admin',
      projectId + '#fragment', projectId + '/../../admin', projectId + '\\evil',
      projectId + '\n', projectId + '\r', projectId + '\u2028', ' ' + projectId,
      projectId + ' ', 'project%2Fadmin'].map(obra => ({ obra })),
  ]) assert.equal(identityWorkspaceProjectHint(query), '');
});

test('a project hint cannot expand authentication return context or carry authority', () => {
  const projectId = 'project-pilot_20261010';
  const query = new URLSearchParams({ participar: invitationId, obra: projectId, scope: 'admin',
    role: 'ADMIN', canManage: 'true', canSend: 'true', token: 'synthetic-session-token',
    redirect_url: 'https://foreign.example' });
  assert.equal(identityWorkspaceProjectHint(query), projectId);
  routes.forEach((route, index) => {
    const destination = route(query);
    assert.equal(destination, paths[index] + '?participar=' + invitationId);
    assert.deepEqual([...new URL(destination, 'https://obrasaas.com').searchParams.keys()], ['participar']);
  });
  assert.equal(identityWorkspaceProjectHint(new URLSearchParams(identityAccountReturnPath(query).split('?')[1])), '');
});
