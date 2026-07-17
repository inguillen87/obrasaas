export const DASHBOARD_TABS = Object.freeze([
  'sec-dashboard',
  'sec-whatsapp',
  'sec-gantt',
  'sec-personal',
]);

const DASHBOARD_TAB_SET = new Set(DASHBOARD_TABS);

export function resolveDashboardTab({ tab, onboarding } = {}) {
  if (onboarding === 'approval') return 'sec-whatsapp';
  return DASHBOARD_TAB_SET.has(tab) ? tab : 'sec-dashboard';
}

export function dashboardDestinationIsActive(destination, {
  pathname,
  tab,
  onboarding,
} = {}) {
  const currentPath = String(pathname || '/dashboard');
  if (destination.tab) {
    return currentPath === '/dashboard'
      && resolveDashboardTab({ tab, onboarding }) === destination.tab;
  }
  if (destination.exact) return currentPath === destination.href;
  return currentPath === destination.href || currentPath.startsWith(`${destination.href}/`);
}
