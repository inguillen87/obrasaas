<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 🤝 OBRASAAS — PROTOCOLO DE SINERGIA TRIPARTITA DE IA (AGENTS UNIVERSAL CONTRACT)
> Este repositorio opera bajo un modelo de colaboración multi-agente entre **Antigravity (Google DeepMind)**, **OpenAI Codex** y **ChatGPT (OpenAI o1/o3-mini/GPT-4o)**.  
> Documento maestro detallado: `docs/TRIAD_AI_SYNERGY_PROTOCOL.md`.

---

## 🏛️ DIVISIÓN DE ROLES Y RESPONSABILIDADES

Cualquier agente que trabaje en este código DEBE identificarse con su rol asignado:

### 1. 🦅 ANTIGRAVITY (Google DeepMind) — Chief Architect & Master Integrator
- **Responsabilidad:** Arquitectura general del sistema, diseño y experiencia de usuario *Dark Obsidian* (`#060913`), visor 3D BIM (`/bim`), simulador operativo en tiempo real (`/dashboard`), coordinación de branches y despliegue a producción en Vercel.
- **Regla:** Mantener consistencia con `@/lib/design-system.js`. Toda UI debe ser fluida, responsiva y en español argentino constructivo estándar.

### 2. ⚙️ OPENAI CODEX (GitHub Copilot / CLI) — Systems & Data Platform Engineer
- **Responsabilidad:** Capa de datos relacional en Prisma (`prisma/schema.prisma` con 140+ modelos), migraciones PostgreSQL, integridad transaccional ACID (3-way match de órdenes de compra, remitos y facturas), webhooks seguros HMAC-SHA256 y suites de tests masivas (`tests/*.test.js`).
- **Regla:** No inventar estados en memoria cuando ya existen modelos en Prisma. Siempre verificar que `npm run prebuild` y `node --test` pasen con 0 errores.

### 3. 🧠 CHATGPT (o1 / o3-mini / GPT-4o) — Domain Logic & Regulatory Officer
- **Responsabilidad:** Razonamiento profundo en legislación argentina:
  - **UOCRA CCT 76/75:** Adicional presentismo 20%, horas extras, régimen de lluvia Art. 21 (mínimo legal garantizado de 2.5 hs).
  - **Ley 22.250:** Libreta IERIC, Fondo de Cese Laboral y Libro de Obra Digital foliado.
  - **CIRSOC 201:** Control de hormigones H-21/H-30, ensayo de Cono de Abrams, probetas IRAM 1534 y recubrimiento 25mm.
  - **Decreto 691/16:** Fórmulas de redeterminación de precios con índices CAC y 5% fondo de reparo.
  - **Supervisión NLP:** Extracción estructurada de entidades de obra desde audios de WhatsApp procesados con Whisper.

---

## 🚦 MATRIZ DE COMPLEJIDAD Y ENRUTAMIENTO DE MODELOS

- **Modelos de Razonamiento Profundo (OpenAI o1 / o3-mini / Gemini Flash Thinking):**
  Usar para: Prevención de race conditions financieras, verificación criptográfica de Webhooks/Flows de Meta, redeterminación polinómica de precios y cumplimiento legal estricto.
- **Modelos de Ejecución Rápida y Precisa (Codex / Flash / GPT-4o):**
  Usar para: Escribir tests de contrato, endpoints REST, validaciones de esquema, refactorizaciones y sincronizaciones de interfaz.

---

## 📋 REGLAS DE ORO DE DESARROLLO (NON-NEGOTIABLE)

1. **Compilación Limpia:** Nunca hacer commit ni push sin haber verificado antes que `npm run prebuild` finalice con código de salida 0.
2. **Preservar los 14 Módulos:** Toda evolución de backend debe enriquecer los módulos existentes de `src/app/*` sin romper rutas ni desmantelar componentes.
3. **Despliegue a Producción:** Una vez validado en `master`, el despliegue oficial se realiza con `npx vercel --prod --yes`.
