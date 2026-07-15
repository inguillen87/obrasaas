import { Geist, Manrope } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
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
  openGraph: {
    title: 'ObraSaaS | La obra avanza por WhatsApp',
    description:
      'Una plataforma operativa para conectar cuadrillas, cronograma, evidencia, suministros y dirección.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'ObraSaaS',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ObraSaaS | El sistema operativo de la obra',
    description: 'De la realidad de campo a una decisión trazable.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${geist.variable} ${manrope.variable}`}>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      <body>
        <ClerkProvider
          taskUrls={{ 'choose-organization': '/session-tasks/choose-organization' }}
          appearance={{
            variables: {
              colorPrimary: '#e98745',
              colorBackground: '#111b19',
              colorForeground: '#f7f5ef',
              borderRadius: '0.85rem',
              fontFamily: 'var(--font-geist)',
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
