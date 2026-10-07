import "./globals.css";
import localFont from "next/font/local";
import { PUBLIC_SITE_ORIGIN, publicPageMetadata } from "./public-site-metadata.mjs";

// Keep the public family names: canonical and legacy styles already use them.
// Discrete faces preserve the weights previously requested from Google Fonts.
const inter = localFont({
  src: [
    { path: "./fonts/inter-latin-variable.woff2", weight: "300", style: "normal" },
    { path: "./fonts/inter-latin-variable.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-variable.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-variable.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-latin-variable.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: true,
  variable: "--font-inter",
  declarations: [{ prop: "font-family", value: "Inter" }],
});

const manrope = localFont({
  src: [
    { path: "./fonts/manrope-latin-variable.woff2", weight: "650", style: "normal" },
    { path: "./fonts/manrope-latin-variable.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: true,
  variable: "--font-manrope",
  declarations: [{ prop: "font-family", value: "Manrope" }],
});

const outfit = localFont({
  src: [
    { path: "./fonts/outfit-latin-variable.woff2", weight: "400", style: "normal" },
    { path: "./fonts/outfit-latin-variable.woff2", weight: "500", style: "normal" },
    { path: "./fonts/outfit-latin-variable.woff2", weight: "600", style: "normal" },
    { path: "./fonts/outfit-latin-variable.woff2", weight: "700", style: "normal" },
    { path: "./fonts/outfit-latin-variable.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-outfit",
  declarations: [{ prop: "font-family", value: "Outfit" }],
});

export const metadata = {
  ...publicPageMetadata('/'),
  applicationName: 'ObraSaaS',
  manifest: '/manifest.json',
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  keywords: ['gestión de obras', 'software para constructoras', 'jornadas de obra', 'materiales de obra', 'planificación de obras'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ObraSaaS',
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
    <html lang="es" className={`${inter.variable} ${manrope.variable} ${outfit.variable}`}>
      <head>
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
