import WorkerPaymentReceiptClient from "./worker-payment-receipt-client";
import styles from "./worker-payment-receipt.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Constancia privada de recepción",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    noimageindex: true,
    nosnippet: true,
  },
  referrer: "no-referrer",
};

const QUERY_FIELDS = new Set(["worker", "receipt"]);
const MAX_ID_LENGTH = 191;

function exactQueryString(query, field) {
  const value = query?.[field];
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_ID_LENGTH
    || value.trim() !== value
  ) {
    return null;
  }
  return value;
}

function receiptQuery(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) return null;
  const keys = Object.keys(query);
  if (keys.length !== QUERY_FIELDS.size || keys.some((key) => !QUERY_FIELDS.has(key))) {
    return null;
  }
  const worker = exactQueryString(query, "worker");
  const receipt = exactQueryString(query, "receipt");
  return worker && receipt ? { worker, receipt } : null;
}

function AccessDenied() {
  return (
    <main className={styles.centeredPage}>
      <section className={styles.deniedCard}>
        <span className={styles.deniedIcon} aria-hidden="true">!</span>
        <p className={styles.eyebrow}>Acceso protegido</p>
        <h1>Este enlace ya no es válido</h1>
        <p>Contactá a la administración por el canal oficial de WhatsApp de tu obra.</p>
      </section>
    </main>
  );
}

export default async function WorkerPaymentReceiptWebview({ searchParams }) {
  const query = receiptQuery(await searchParams);
  if (!query) return <AccessDenied />;

  return (
    <WorkerPaymentReceiptClient
      receipt={query.receipt}
      worker={query.worker}
    />
  );
}
