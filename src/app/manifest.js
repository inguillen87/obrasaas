export default function manifest() {
  return {
    name: 'ObraSaaS · Operación de obra conectada',
    short_name: 'ObraSaaS',
    description: 'Conecta reportes de campo, cronograma, evidencia, suministros y dirección desde WhatsApp y la web.',
    start_url: '/',
    display: 'standalone',
    background_color: '#08110f',
    theme_color: '#08110f',
    lang: 'es',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/brand/obrasaas-app-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/brand/obrasaas-app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/obrasaas-app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/obrasaas-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
