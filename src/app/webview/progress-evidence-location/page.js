import ProgressEvidenceLocationClient from "./progress-evidence-location-client";
import styles from "../webview.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Ubicación de evidencia de avance",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const QUERY_FIELDS = new Set(["worker", "session"]);
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

function progressEvidenceQuery(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) return null;
  const keys = Object.keys(query);
  if (keys.length !== QUERY_FIELDS.size || keys.some((key) => !QUERY_FIELDS.has(key))) {
    return null;
  }
  const worker = exactQueryString(query, "worker");
  const session = exactQueryString(query, "session");
  return worker && session ? { worker, session } : null;
}

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

export default async function ProgressEvidenceLocationWebview({ searchParams }) {
  const query = progressEvidenceQuery(await searchParams);
  if (!query) return <AccessDenied />;

  return (
    <ProgressEvidenceLocationClient
      worker={query.worker}
      session={query.session}
    />
  );
}
