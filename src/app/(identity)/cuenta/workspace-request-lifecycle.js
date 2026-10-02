'use client';
import {useEffect,useMemo} from 'react';
import {createWorkspaceRequestLifecycle} from './workspace-request-lifecycle.mjs';
import {browserRecoveryJournal} from './workspace-recovery-journal.mjs';

export function useWorkspaceRequest(getSessionToken) {
  const lifecycle = useMemo(() => createWorkspaceRequestLifecycle(getSessionToken,{journal:browserRecoveryJournal}), [getSessionToken]);
  useEffect(() => { lifecycle.activate(); return () => lifecycle.abort(); }, [lifecycle]);
  return lifecycle.request;
}
