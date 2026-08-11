'use client';

import { Analytics } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';

export function observabilityPathIsExcluded(pathname) {
  return pathname === '/dashboard/privacy';
}

export function sanitizeAnalyticsEvent(event) {
  try {
    const url = new URL(event.url);
    if (
      url.pathname.startsWith('/webview/')
      || observabilityPathIsExcluded(url.pathname)
    ) return null;
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export default function Observability({ enabled = false }) {
  const pathname = usePathname();
  if (!enabled || observabilityPathIsExcluded(pathname)) return null;
  return (
    <Analytics beforeSend={sanitizeAnalyticsEvent} />
  );
}
