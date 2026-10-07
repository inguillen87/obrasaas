import {PUBLIC_SITE_ORIGIN, PUBLIC_SITE_PATHS} from './public-site-metadata.mjs';

export default function sitemap() {
  return PUBLIC_SITE_PATHS.map(path => ({ url: PUBLIC_SITE_ORIGIN + path }));
}
