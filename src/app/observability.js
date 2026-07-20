'use client';

import { Analytics } from '@vercel/analytics/next';

function sanitizeAnalyticsEvent(event) {
  try {
    const url = new URL(event.url);
    if (url.pathname.startsWith('/webview/')) return null;
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export default function Observability({ enabled = false }) {
  if (!enabled) return null;
  return (
    <Analytics beforeSend={sanitizeAnalyticsEvent} />
  );
}
