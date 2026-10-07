import {PUBLIC_SITE_ORIGIN, PUBLIC_SITE_PATHS} from './public-site-metadata.mjs';
import {BRAND_PUBLIC_ASSETS} from '../lib/brand-assets.mjs';
import {LAUNCH_PUBLIC_ASSETS} from '../lib/legacy-access-boundary.js';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: [...PUBLIC_SITE_PATHS, ...BRAND_PUBLIC_ASSETS, ...LAUNCH_PUBLIC_ASSETS, '/robots.txt', '/sitemap.xml'].map(path => path + '$').concat('/_next/static/'),
      disallow: '/',
    },
    sitemap: PUBLIC_SITE_ORIGIN + '/sitemap.xml',
  };
}
