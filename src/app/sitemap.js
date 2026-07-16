function publicOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'https://obrasaas-preview.vercel.app');
  return configured.replace(/\/$/, '');
}

export default function sitemap() {
  const origin = publicOrigin();
  const lastModified = new Date();

  return [
    { url: `${origin}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/privacy`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${origin}/terms`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${origin}/data-deletion`, lastModified, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
