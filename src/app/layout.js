import "./globals.css";

export const metadata = {
  title: "ObraSaaS - Plataforma SaaS de Control de Obras",
  description: "Control de presentismo por voz, Gantt dinámico y logística de acopios integrada.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link rel="stylesheet" href="https://unpkg.com/aos@2.3.1/dist/aos.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
