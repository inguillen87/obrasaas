import { readWebviewToken } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import MedicalClient from "./medical-client";
import styles from "../webview.module.css";

export const metadata = {
  title: "Certificado médico",
  robots: { index: false, follow: false },
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

export default async function MedicalWebview({ searchParams }) {
  const query = await searchParams;
  const worker = Array.isArray(query.worker) ? query.worker[0] : query.worker || "";
  const token = Array.isArray(query.token) ? query.token[0] : query.token || "";
  const tokenPayload = readWebviewToken(worker, token, { purpose: "medical" });
  if (!tokenPayload?.ctx) return <AccessDenied />;
  const fieldWorker = await getPrisma().worker.findFirst({
    where: { id: worker, projectId: tokenPayload.ctx, active: true },
    select: { name: true },
  });
  if (!fieldWorker) return <AccessDenied />;

  return <MedicalClient worker={worker} token={token} name={fieldWorker.name} />;
}
