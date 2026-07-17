import { Geist, Manrope } from 'next/font/google';
import Observability from './observability';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://obrasaas-preview.vercel.app'),
  ),
  title: {
    default: 'ObraSaaS | El sistema operativo de la obra',
    template: '%s | ObraSaaS',
  },
  description:
    'Convierte reportes de WhatsApp, fotos, ubicación y formularios de campo en tareas, evidencia, cronograma y decisiones trazables.',
  keywords: [
    'software de construcción',
    'control de obra',
    'WhatsApp para constructoras',
    'gestión de obras',
    'Gantt de obra',
    'tecnología para construcción LATAM',
  ],
  category: 'construction technology',
};

export default function RootLayout({ children }) {
  return (
    <html
      className={`${geist.variable} ${manrope.variable}`}
      data-scroll-behavior="smooth"
      lang="es"
    >
      <body>
        {children}
        <Observability />
      </body>
    </html>
  );
}
