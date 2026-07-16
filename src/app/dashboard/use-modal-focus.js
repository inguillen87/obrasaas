'use client';

import { useCallback, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => element.getClientRects().length > 0);
}

export function useModalFocus({ locked = false, onRequestClose, open }) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const lockedRef = useRef(locked);
  const closeRef = useRef(onRequestClose);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    closeRef.current = onRequestClose;
  }, [onRequestClose]);

  const captureReturnFocus = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const focusFrame = requestAnimationFrame(() => {
      const preferred = dialog?.querySelector('[data-autofocus]');
      const first = preferred || focusableElements(dialog)[0] || dialog;
      first?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !lockedRef.current) {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey
        && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      const returnTarget = returnFocusRef.current;
      requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    };
  }, [open]);

  return { captureReturnFocus, dialogRef };
}
