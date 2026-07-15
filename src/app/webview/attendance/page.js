import { verifyWebviewToken } from "@/lib/auth";
import AttendanceClient from "./attendance-client";
import styles from "../webview.module.css";

export const metadata = {
  title: "Fichaje de obra | ObraSaaS",
  robots: { index: false, follow: false },
};

const knownNames = {
  juan: "Juan Gómez",
  carlos: "Carlos Pérez",
  luis: "Luis Martínez",
};

function AccessDenied() {
  return (
    <main className={styles.centeredPage}>
      <section className={styles.deniedCard}>
        <span className={styles.deniedIcon} aria-hidden="true">!</span>
        <p className={styles.eyebrow}>Acceso protegido</p>
        <h1>Este enlace ya no es válido</h1>
        <p>Pedí un nuevo enlace desde el chat oficial de WhatsApp de tu obra.</p>
      </section>
    </main>
  );
}

export default async function AttendanceWebview({ searchParams }) {
  const query = await searchParams;
  const worker = Array.isArray(query.worker) ? query.worker[0] : query.worker || "";
  const token = Array.isArray(query.token) ? query.token[0] : query.token || "";
  if (!verifyWebviewToken(worker, token, { purpose: "attendance" })) return <AccessDenied />;

  const name = knownNames[worker] || `Operario ${worker.replace(/\D/g, "").slice(-4) || "de obra"}`;
  return <AttendanceClient worker={worker} token={token} name={name} />;
}
