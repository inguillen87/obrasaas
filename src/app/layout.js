import "./globals.css";

export const metadata = {
  title: "ObraSaaS — Plataforma Enterprise de Control de Obra & Certificaciones Digitales",
  description: "Sistema integral de gestión de obras con WhatsApp Bot IA, KYC biométrico, geocerca GPS, Libro de Obra Digital (Ley 22.250), Curva S financiera y certificaciones SHA-256. La plataforma #1 para constructoras en Argentina y LATAM.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://obrasaas.vercel.app"),
  openGraph: {
    title: "ObraSaaS — Plataforma Enterprise de Control de Obra",
    description: "WhatsApp Bot IA + Geocerca GPS + Certificaciones SHA-256 para constructoras, desarrolladoras inmobiliarias y gobiernos.",
    url: "https://obrasaas.vercel.app",
    siteName: "ObraSaaS",
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ObraSaaS — Control de Obra Enterprise",
    description: "La plataforma #1 para constructoras en Argentina. WhatsApp + IA + GPS + Certificaciones digitales.",
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
  themeColor: "#f59e0b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="stylesheet" href="https://unpkg.com/aos@2.3.1/dist/aos.css" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
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
