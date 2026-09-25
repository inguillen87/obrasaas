export const WORKSPACE_LEAVE_EVENT = 'obrasaas:before-workspace-navigation';
export function evaluateWorkspaceLeave({ dirty, busy, confirmed = false }) {
  if (busy) return 'WAIT';
  if (dirty && !confirmed) return 'CONFIRM';
  return 'ALLOW';
}
export function requestWorkspaceNavigation(kind = 'route') {
  if (typeof window === 'undefined') return false;
  return window.dispatchEvent(new CustomEvent(WORKSPACE_LEAVE_EVENT, { cancelable: true, detail: { kind } }));
}
