import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dashboardDestinationIsActive,
  resolveDashboardTab,
} from '../src/lib/dashboard-navigation.js';

test('dashboard navigation resolves URL tabs and defaults safely', () => {
  assert.equal(resolveDashboardTab(), 'sec-dashboard');
  assert.equal(resolveDashboardTab({ tab: 'sec-gantt' }), 'sec-gantt');
  assert.equal(resolveDashboardTab({ tab: 'unknown' }), 'sec-dashboard');
  assert.equal(
    resolveDashboardTab({ tab: 'sec-gantt', onboarding: 'approval' }),
    'sec-whatsapp',
  );
});

test('dashboard navigation marks one tab destination active', () => {
  const gantt = { href: '/dashboard', tab: 'sec-gantt' };
  const summary = { href: '/dashboard', tab: 'sec-dashboard' };
  const location = { pathname: '/dashboard', tab: 'sec-gantt' };

  assert.equal(dashboardDestinationIsActive(gantt, location), true);
  assert.equal(dashboardDestinationIsActive(summary, location), false);
  assert.equal(
    dashboardDestinationIsActive(gantt, { pathname: '/dashboard/projects', tab: 'sec-gantt' }),
    false,
  );
});

test('dashboard navigation distinguishes exact and nested routes', () => {
  assert.equal(
    dashboardDestinationIsActive(
      { href: '/dashboard/projects', exact: true },
      { pathname: '/dashboard/projects' },
    ),
    true,
  );
  assert.equal(
    dashboardDestinationIsActive(
      { href: '/dashboard', exact: true },
      { pathname: '/dashboard/projects' },
    ),
    false,
  );
});
