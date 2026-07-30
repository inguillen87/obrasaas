import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  OBRA_SAAS_STRUCTURE_PATH,
  OBRA_SAAS_TRACE_PATH,
} from "../app/brand/brand-geometry.js";

const A4 = Object.freeze({ width: 595.28, height: 841.89 });
const MARGIN = 48;
const CONTENT_WIDTH = A4.width - (MARGIN * 2);
const RECEIPT_FIELDS = new Set([
  "reference",
  "receivedAt",
  "issuedAt",
  "paymentPurpose",
  "destinationType",
  "maskedReference",
  "status",
  "integritySha256",
]);
const PAYMENT_PURPOSES = new Set(["SALARY", "REIMBURSEMENT"]);
const DESTINATION_TYPES = new Set(["CBU", "CVU", "ALIAS"]);
const OPAQUE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,95}$/;
const MASKED_BANK_REFERENCE_PATTERN = /^•••• [0-9]{4}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const FONT_PATHS = Object.freeze({
  regular: path.join(process.cwd(), "node_modules", "source-sans", "TTF", "SourceSans3-Regular.ttf"),
  bold: path.join(process.cwd(), "node_modules", "source-sans", "TTF", "SourceSans3-Bold.ttf"),
});
const COLORS = Object.freeze({
  ink: rgb(0.055, 0.102, 0.094),
  body: rgb(0.22, 0.29, 0.27),
  muted: rgb(0.43, 0.49, 0.47),
  line: rgb(0.85, 0.88, 0.87),
  paper: rgb(0.99, 0.985, 0.965),
  panel: rgb(0.95, 0.965, 0.955),
  orange: rgb(0.94, 0.46, 0.12),
  orangeSoft: rgb(1, 0.955, 0.89),
  green: rgb(0.1, 0.5, 0.37),
  greenSoft: rgb(0.9, 0.97, 0.94),
  white: rgb(1, 1, 1),
});
const PURPOSE_LABELS = Object.freeze({
  SALARY: "Haberes",
  REIMBURSEMENT: "Reintegro",
});

export const WORKER_PAYMENT_RECEIPT_DISCLAIMER = "Esta constancia no acredita titularidad, validación bancaria, activación, transferencia ni pago. Confirma únicamente que ObraSaaS recibió un destino de cobro para revisión.";

let fontBytesPromise;

function hasExactFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.size && keys.every((key) => fields.has(key));
}

function canonicalTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
}

function safeMaskedReference(destinationType, value) {
  if (value === null) return null;
  if (
    (destinationType === "CBU" || destinationType === "CVU")
    && typeof value === "string"
    && MASKED_BANK_REFERENCE_PATTERN.test(value)
  ) {
    return value;
  }
  return null;
}

function invalidReceiptDto() {
  throw new TypeError("Worker payment receipt PDF DTO is invalid.");
}

export function normalizeWorkerPaymentReceiptPdfDto(value) {
  if (!hasExactFields(value, RECEIPT_FIELDS)) return invalidReceiptDto();
  const receivedAt = canonicalTimestamp(value.receivedAt);
  const issuedAt = canonicalTimestamp(value.issuedAt);
  const maskedReference = safeMaskedReference(value.destinationType, value.maskedReference);
  if (
    !OPAQUE_REFERENCE_PATTERN.test(value.reference || "")
    || !receivedAt
    || !issuedAt
    || Date.parse(issuedAt) < Date.parse(receivedAt)
    || !PAYMENT_PURPOSES.has(value.paymentPurpose)
    || !DESTINATION_TYPES.has(value.destinationType)
    || value.status !== "RECEIVED_FOR_REVIEW"
    || !SHA256_PATTERN.test(value.integritySha256 || "")
    || (value.maskedReference !== null && maskedReference === null)
    || (value.destinationType === "ALIAS" && value.maskedReference !== null)
  ) {
    return invalidReceiptDto();
  }
  return Object.freeze({
    reference: value.reference,
    receivedAt,
    issuedAt,
    paymentPurpose: value.paymentPurpose,
    destinationType: value.destinationType,
    maskedReference,
    status: value.status,
    integritySha256: value.integritySha256,
  });
}

function pdfText(value, maximumLength = 2_000) {
  const output = String(value ?? "")
    .replace(/[\u2010-\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\p{Cc}\p{Cs}]/gu, "?")
    .replace(/\s+/g, " ")
    .trim();
  const limit = Math.max(3, Number(maximumLength) || 2_000);
  const characters = Array.from(output);
  return characters.length > limit
    ? `${characters.slice(0, limit - 3).join("")}...`
    : output;
}

function slug(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "privada";
}

export function workerPaymentReceiptPdfFilename(receipt) {
  const normalized = normalizeWorkerPaymentReceiptPdfDto(receipt);
  return `constancia-recepcion-${slug(normalized.reference)}.pdf`;
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

async function loadFontBytes() {
  if (!fontBytesPromise) {
    fontBytesPromise = Promise.all([
      readFile(FONT_PATHS.regular),
      readFile(FONT_PATHS.bold),
    ]).catch((error) => {
      fontBytesPromise = undefined;
      throw error;
    });
  }
  return fontBytesPromise;
}

function wrapText(value, font, size, maximumWidth) {
  const words = pdfText(value).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maximumWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line || lines.length === 0) lines.push(line || "-");
  return lines;
}

function wrapCharacters(value, font, size, maximumWidth) {
  const lines = [];
  let line = "";
  for (const character of pdfText(value)) {
    const candidate = `${line}${character}`;
    if (line && font.widthOfTextAtSize(candidate, size) > maximumWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }
  if (line || lines.length === 0) lines.push(line || "-");
  return lines;
}

function drawWrappedText(page, lines, options) {
  lines.forEach((line, index) => {
    page.drawText(line, {
      ...options,
      y: options.y - (index * options.lineHeight),
    });
  });
}

export async function renderWorkerPaymentReceiptPdf(receipt) {
  const value = normalizeWorkerPaymentReceiptPdfDto(receipt);
  // pdf-lib otherwise writes the wall-clock time into the Info dictionary.
  // Disabling that default keeps retries byte-for-byte reproducible; the
  // trusted issuedAt timestamp is applied explicitly below.
  const pdfDoc = await PDFDocument.create({ updateMetadata: false });
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await loadFontBytes();
  const regular = await pdfDoc.embedFont(regularBytes, { subset: true });
  const bold = await pdfDoc.embedFont(boldBytes, { subset: true });
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  const issuedAt = new Date(value.issuedAt);

  pdfDoc.setTitle(`Constancia privada de recepción - ${value.reference}`);
  pdfDoc.setAuthor("ObraSaaS");
  pdfDoc.setSubject(WORKER_PAYMENT_RECEIPT_DISCLAIMER);
  pdfDoc.setKeywords(["ObraSaaS", "constancia privada de recepción", "destino de cobro"]);
  pdfDoc.setProducer("ObraSaaS Private Receipt Engine");
  pdfDoc.setCreator("ObraSaaS");
  pdfDoc.setCreationDate(issuedAt);
  pdfDoc.setModificationDate(issuedAt);
  if (typeof pdfDoc.setLanguage === "function") pdfDoc.setLanguage("es-AR");

  const page = pdfDoc.addPage([A4.width, A4.height]);
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: COLORS.paper });
  page.drawRectangle({ x: 0, y: A4.height - 6, width: A4.width, height: 6, color: COLORS.orange });

  page.drawSvgPath(OBRA_SAAS_STRUCTURE_PATH, {
    x: MARGIN,
    y: A4.height - 38,
    scale: 0.4,
    color: COLORS.ink,
  });
  page.drawSvgPath(OBRA_SAAS_TRACE_PATH, {
    x: MARGIN,
    y: A4.height - 38,
    scale: 0.4,
    borderColor: COLORS.orange,
    borderLineCap: LineCapStyle.Round,
    borderWidth: 7,
  });
  page.drawText("ObraSaaS", {
    x: MARGIN + 37,
    y: A4.height - 59,
    size: 13,
    font: bold,
    color: COLORS.ink,
  });
  page.drawText("DOCUMENTO PRIVADO", {
    x: A4.width - MARGIN - bold.widthOfTextAtSize("DOCUMENTO PRIVADO", 7),
    y: A4.height - 54,
    size: 7,
    font: bold,
    color: COLORS.orange,
  });

  page.drawText("CONSTANCIA PRIVADA DE RECEPCIÓN", {
    x: MARGIN,
    y: A4.height - 116,
    size: 8,
    font: bold,
    color: COLORS.orange,
  });
  page.drawText("Destino de cobro recibido", {
    x: MARGIN,
    y: A4.height - 152,
    size: 25,
    font: bold,
    color: COLORS.ink,
  });
  const introduction = wrapText(
    "ObraSaaS recibió un destino de cobro para revisión. Este documento muestra únicamente datos enmascarados y una referencia opaca.",
    regular,
    10,
    CONTENT_WIDTH,
  );
  drawWrappedText(page, introduction, {
    x: MARGIN,
    y: A4.height - 178,
    size: 10,
    lineHeight: 14,
    font: regular,
    color: COLORS.body,
  });

  const statusTop = A4.height - 225;
  page.drawRectangle({
    x: MARGIN,
    y: statusTop - 54,
    width: CONTENT_WIDTH,
    height: 54,
    color: COLORS.greenSoft,
    borderColor: COLORS.green,
    borderWidth: 0.7,
  });
  page.drawCircle({ x: MARGIN + 24, y: statusTop - 27, size: 10, color: COLORS.green });
  page.drawText("✓", {
    x: MARGIN + 20.5,
    y: statusTop - 31,
    size: 10,
    font: bold,
    color: COLORS.white,
  });
  page.drawText("ESTADO", {
    x: MARGIN + 44,
    y: statusTop - 20,
    size: 6.5,
    font: bold,
    color: COLORS.green,
  });
  page.drawText("Recibido para revisión", {
    x: MARGIN + 44,
    y: statusTop - 39,
    size: 12,
    font: bold,
    color: COLORS.ink,
  });

  const rows = [
    ["Referencia de constancia", value.reference],
    ["Recibido", formatTimestamp(value.receivedAt)],
    ["Emitido", formatTimestamp(value.issuedAt)],
    ["Finalidad", PURPOSE_LABELS[value.paymentPurpose]],
    ["Tipo de destino", value.destinationType],
    ["Referencia enmascarada", value.maskedReference || "No exhibida por seguridad"],
  ];
  const tableTop = statusTop - 78;
  const rowHeight = 43;
  rows.forEach(([label, content], index) => {
    const y = tableTop - (index * rowHeight);
    page.drawRectangle({
      x: MARGIN,
      y: y - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: index % 2 === 0 ? COLORS.white : COLORS.panel,
      borderColor: COLORS.line,
      borderWidth: 0.45,
    });
    page.drawText(label.toUpperCase(), {
      x: MARGIN + 13,
      y: y - 17,
      size: 6.3,
      font: bold,
      color: COLORS.muted,
    });
    const safeContent = pdfText(content, 120);
    if (label === "Referencia de constancia") {
      const referenceLines = wrapCharacters(safeContent, mono, 7.2, CONTENT_WIDTH - 205);
      drawWrappedText(page, referenceLines, {
        x: MARGIN + 190,
        y: y - (referenceLines.length > 1 ? 18 : 25),
        size: 7.2,
        lineHeight: 10,
        font: mono,
        color: COLORS.orange,
      });
    } else {
      page.drawText(safeContent, {
        x: MARGIN + 190,
        y: y - 25,
        size: 9,
        font: bold,
        color: COLORS.ink,
      });
    }
  });

  const hashTop = tableTop - (rows.length * rowHeight) - 18;
  page.drawRectangle({
    x: MARGIN,
    y: hashTop - 57,
    width: CONTENT_WIDTH,
    height: 57,
    color: COLORS.ink,
  });
  page.drawText("HUELLA DE INTEGRIDAD SHA-256", {
    x: MARGIN + 14,
    y: hashTop - 18,
    size: 6.2,
    font: bold,
    color: COLORS.orange,
  });
  page.drawText(value.integritySha256, {
    x: MARGIN + 14,
    y: hashTop - 39,
    size: 7.2,
    font: mono,
    color: COLORS.white,
  });

  const noticeTop = hashTop - 75;
  const disclaimerLines = wrapText(WORKER_PAYMENT_RECEIPT_DISCLAIMER, regular, 8.5, CONTENT_WIDTH - 32);
  page.drawRectangle({
    x: MARGIN,
    y: noticeTop - 76,
    width: CONTENT_WIDTH,
    height: 76,
    color: COLORS.orangeSoft,
    borderColor: COLORS.orange,
    borderWidth: 0.7,
  });
  page.drawText("ALCANCE DE ESTA CONSTANCIA", {
    x: MARGIN + 16,
    y: noticeTop - 19,
    size: 6.5,
    font: bold,
    color: COLORS.orange,
  });
  drawWrappedText(page, disclaimerLines, {
    x: MARGIN + 16,
    y: noticeTop - 39,
    size: 8.5,
    lineHeight: 12,
    font: regular,
    color: COLORS.body,
  });

  page.drawLine({
    start: { x: MARGIN, y: 52 },
    end: { x: A4.width - MARGIN, y: 52 },
    thickness: 0.55,
    color: COLORS.line,
  });
  page.drawText("No contiene el CBU, CVU o alias completo.", {
    x: MARGIN,
    y: 34,
    size: 6.8,
    font: regular,
    color: COLORS.muted,
  });
  page.drawText("1 / 1", {
    x: A4.width - MARGIN - bold.widthOfTextAtSize("1 / 1", 6.8),
    y: 34,
    size: 6.8,
    font: bold,
    color: COLORS.muted,
  });

  return pdfDoc.save();
}
