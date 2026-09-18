'use client';
import { useEffect } from 'react';
import { evaluateWorkspaceLeave, WORKSPACE_LEAVE_EVENT } from '@/lib/workspace-leave-policy';
export function useWorkspaceLeaveGuard({ dirty, busy, message = 'Hay cambios sin guardar. ¿Descartarlos y continuar?' }) {
  useEffect(() => {
    const onNavigate = event => {
      if (event.defaultPrevented) return;
      const decision = evaluateWorkspaceLeave({ dirty, busy });
      if (decision === 'WAIT' || (decision === 'CONFIRM' && !window.confirm(message))) event.preventDefault();
    };
    window.addEventListener(WORKSPACE_LEAVE_EVENT, onNavigate);
    return () => window.removeEventListener(WORKSPACE_LEAVE_EVENT, onNavigate);
  }, [dirty, busy, message]);
}
