'use client';
import {useEffect,useMemo} from 'react';
import {createWorkspaceRequestLifecycle} from './workspace-request-lifecycle.mjs';

export function useWorkspaceRequest(getSessionToken) {
  const lifecycle = useMemo(() => createWorkspaceRequestLifecycle(getSessionToken), [getSessionToken]);
  useEffect(() => { lifecycle.activate(); return () => lifecycle.abort(); }, [lifecycle]);
  return lifecycle.request;
}
