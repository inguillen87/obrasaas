import { ATTENDANCE_ACTIONS, readWebviewToken } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import AttendanceClient from "./attendance-client";
import styles from "../webview.module.css";

export const metadata = {
  title: "Fichaje de obra",
  robots: { index: false, follow: false },
};

const ACTION_COPY = Object.freeze({
  [ATTENDANCE_ACTIONS.CHECK_IN]: {
    eyebrow: "Inicio de jornada",
    title: "Confirmá tu entrada en obra",
    lead: "Tomaremos una lectura puntual del dispositivo para contrastarla con la geocerca activa.",
    initialStatus: "Listo para registrar tu entrada.",
    requestingLocation: "Obteniendo una ubicación precisa…",
    submitting: "Contrastando la ubicación con la geocerca…",
    button: "Autorizar ubicación y registrar entrada",
    completedButton: "Entrada registrada",
    locationRequired: true,
    steps: ["Autorizás una lectura puntual", "Contrastamos la geocerca", "Registramos la entrada"],
  },
  [ATTENDANCE_ACTIONS.BREAK_START]: {
    eyebrow: "Pausa de jornada",
    title: "Registrá el inicio de tu pausa",
    lead: "Usaremos la hora segura del servidor. Esta acción no solicita ubicación.",
    initialStatus: "Listo para iniciar tu pausa.",
    submitting: "Registrando el inicio de la pausa…",
    button: "Iniciar pausa",
    completedButton: "Pausa iniciada",
    locationRequired: false,
    steps: ["Revisás la acción", "Registramos la hora", "Confirmamos la pausa"],
  },
  [ATTENDANCE_ACTIONS.BREAK_END]: {
    eyebrow: "Regreso a la jornada",
    title: "Confirmá tu regreso de la pausa",
    lead: "Usaremos la hora segura del servidor. Esta acción no solicita ubicación.",
    initialStatus: "Listo para registrar tu regreso.",
    submitting: "Registrando el regreso a la jornada…",
    button: "Finalizar pausa",
    completedButton: "Regreso registrado",
    locationRequired: false,
    steps: ["Revisás la acción", "Registramos la hora", "Confirmamos el regreso"],
  },
  [ATTENDANCE_ACTIONS.CHECK_OUT]: {
    eyebrow: "Fin de jornada",
    title: "Confirmá tu salida de obra",
    lead: "Tomaremos una lectura puntual del dispositivo para contrastarla con la geocerca activa.",
    initialStatus: "Listo para registrar tu salida.",
    requestingLocation: "Obteniendo una ubicación precisa…",
    submitting: "Contrastando la ubicación y registrando la salida…",
    button: "Autorizar ubicación y registrar salida",
    completedButton: "Salida registrada",
    locationRequired: true,
    steps: ["Autorizás una lectura puntual", "Contrastamos la geocerca", "Registramos la salida"],
  },
});

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
  const tokenPayload = readWebviewToken(worker, token, { purpose: "attendance" });
  if (!tokenPayload?.ctx) return <AccessDenied />;
  const action = tokenPayload.act || ATTENDANCE_ACTIONS.CHECK_IN;
  const copy = ACTION_COPY[action];
  if (!copy) return <AccessDenied />;
  const fieldWorker = await getPrisma().worker.findFirst({
    where: { id: worker, projectId: tokenPayload.ctx, active: true },
    select: {
      name: true,
      project: { select: { name: true } },
    },
  });
  if (!fieldWorker) return <AccessDenied />;

  return (
    <AttendanceClient
      worker={worker}
      token={token}
      action={action}
      name={fieldWorker.name}
      projectName={fieldWorker.project.name}
      copy={copy}
    />
  );
}
