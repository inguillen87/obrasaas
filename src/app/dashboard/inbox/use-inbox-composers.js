'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createInboxComposerBook } from '@/lib/whatsapp/inbox-composer-book';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
export default function useInboxComposers({ organizationId, projectId }, conversationId) {
  const [book] = useState(() => createInboxComposerBook({ organizationId, projectId }));
  const snapshot = useSyncExternalStore(book.subscribe, book.getSnapshot, book.getSnapshot);
  const entries = Object.values(snapshot.entries);
  const dirty = entries.some(entry => Boolean(entry.draft || entry.attempt));
  const busy = entries.some(entry => entry.sending);
  useWorkspaceLeaveGuard({ dirty, busy });
  useEffect(() => {
    const warn = event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  return { book, entries: snapshot.entries, current: book.get(conversationId), dirty, busy };
}
