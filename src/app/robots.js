function publicOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://obrasaas-preview.vercel.app');
  return configured.replace(/\/$/, '');
}

export default function robots() {
  const origin = publicOrigin();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api',
        '/dashboard',
        '/presupuesto',
        '/session-tasks',
        '/sign-in',
        '/sign-up',
        '/superadmin',
        '/webview',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
