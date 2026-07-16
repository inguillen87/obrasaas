export default function manifest() {
  return {
    name: 'ObraSaaS · Sistema operativo de obra',
    short_name: 'ObraSaaS',
    description: 'Conecta reportes de campo, cronograma, evidencia, suministros y dirección desde WhatsApp y la web.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0b0c',
    theme_color: '#0a0b0c',
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
        src: '/brand/obrasaas-app-icon-1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
