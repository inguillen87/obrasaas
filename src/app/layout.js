import "./globals.css";

export const metadata = {
  title: "ObraSaaS — Gestión y seguimiento de obras",
  description: "Organizá participantes, jornadas, evidencias privadas, tareas y materiales de cada obra. Revisá identidades y propuestas de avance con permisos y recibos de operación.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://obrasaas.com"),
  openGraph: {
    title: "ObraSaaS — Gestión y seguimiento de obras",
    description: "Planificación, actividad de campo, evidencias privadas y decisiones autorizadas para constructoras.",
    url: "https://obrasaas.com",
    siteName: "ObraSaaS",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ObraSaaS — Gestión y seguimiento de obras",
    description: "Organizá tu equipo y seguí cada obra con tareas, materiales, evidencias y revisiones autorizadas.",
  },
  keywords: ["control de obra", "software construcción", "SaaS constructoras", "gestión de obras Argentina", "libro de obra digital", "UOCRA", "ART", "certificaciones digitales", "WhatsApp obra"],
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ObraSaaS",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#08110F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Manrope:wght@650;800&display=swap" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="stylesheet" href="https://unpkg.com/aos@2.3.1/dist/aos.css" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ '--font-manrope': '"Manrope"', '--font-geist': '"Inter"' }}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('✅ ObraSaaS SW registered:', reg.scope))
                    .catch(err => console.warn('SW registration failed:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
