export const PUBLIC_SITE_ORIGIN = 'https://obrasaas.com';
export const PUBLIC_SHARE_IMAGE = Object.freeze({
  url: PUBLIC_SITE_ORIGIN + '/brand/obrasaas-social-v1.png',
  width: 1200,
  height: 630,
  alt: 'ObraSaaS. Cada obra, bien organizada. Jornadas, avances y materiales.',
  type: 'image/png',
});

const pages = Object.freeze({
  '/': {
    title: 'ObraSaaS | Gestión de obras para constructoras',
    description: 'Organizá a tu equipo y seguí jornadas, avances y materiales de cada obra. Empezá por la web; prepará WhatsApp desde tu cuenta.',
  },
  '/manual': {
    title: 'Manual de inicio y WhatsApp | ObraSaaS',
    description: 'Abrí tu empresa, prepará la primera obra e incorporá al equipo con permisos y revisión humana. Conocé los requisitos para preparar WhatsApp.',
  },
  '/demo': {
    title: 'Demo ObraSaaS | Una obra de ejemplo',
    description: 'Explorá una empresa y una obra de ejemplo: cronograma, materiales, incidencias, equipo y clientes. Los datos son ilustrativos.',
  },
  '/privacidad': {
    title: 'Política de privacidad | ObraSaaS',
    description: 'Conocé qué datos utiliza ObraSaaS, sus finalidades, proveedores y autorizaciones. Consultá cómo ejercer tus derechos sobre tus datos personales.',
  },
  '/terminos': {
    title: 'Términos de uso | ObraSaaS',
    description: 'Consultá las condiciones de uso de ObraSaaS, el alcance de los permisos y registros, la revisión humana y los requisitos de servicios externos.',
  },
  '/eliminacion-datos': {
    title: 'Eliminación de datos | ObraSaaS',
    description: 'Solicitá por correo la eliminación de tus datos en ObraSaaS. Conocé los datos mínimos necesarios, la verificación y el seguimiento manual del pedido.',
  },
});

export const PUBLIC_SITE_PATHS = Object.freeze(Object.keys(pages));

// Static public copy only. Private paths, query strings and tenant input are rejected.
export function publicPageMetadata(pathname) {
  if (typeof pathname !== 'string' || !Object.hasOwn(pages, pathname)) throw new RangeError('PUBLIC_METADATA_PATH_REQUIRED');
  const page = pages[pathname];
  const url = PUBLIC_SITE_ORIGIN + (pathname === '/' ? '/' : pathname);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: 'ObraSaaS',
      locale: 'es_AR',
      type: 'website',
      images: [{ ...PUBLIC_SHARE_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: page.title,
      description: page.description,
      images: [{ ...PUBLIC_SHARE_IMAGE }],
    },
    robots: { index: true, follow: true },
  };
}
