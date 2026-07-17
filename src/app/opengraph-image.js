import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const alt = 'ObraSaaS · La obra habla y la operación entiende qué hacer';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const lockup = await readFile(
    path.join(process.cwd(), 'public', 'brand', 'obrasaas-lockup-inverse.svg'),
  );
  const lockupSource = `data:image/svg+xml;base64,${lockup.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          color: '#f7f7f2',
          background: '#08110f',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            opacity: .28,
            backgroundImage: 'linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 520,
            height: 520,
            top: -250,
            left: -120,
            display: 'flex',
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(242,138,66,.28) 0%, rgba(242,138,66,.08) 48%, transparent 72%)',
          }}
        />
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 64,
            padding: '70px 78px',
          }}
        >
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', height: 48 }}>
              {/* The official vector lockup keeps the wordmark geometry identical across every social card. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lockupSource}
                width={200}
                height={48}
                alt="ObraSaaS"
              />
            </div>
            <div style={{ marginTop: 68, color: '#f28a42', fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>
              OPERACIÓN DE OBRA CONECTADA
            </div>
            <div style={{ marginTop: 20, fontSize: 58, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
              La obra habla.
            </div>
            <div style={{ marginTop: 12, color: '#f28a42', fontSize: 58, fontWeight: 700, lineHeight: 1.02, letterSpacing: -3 }}>
              La operación entiende.
            </div>
            <div style={{ marginTop: 30, color: '#a8adb3', fontSize: 22, lineHeight: 1.45 }}>
              Voz, fotos y WhatsApp convertidos en avance, evidencia y decisiones trazables.
            </div>
          </div>
          <div
            style={{
              width: 310,
              height: 430,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,.18)',
              borderRadius: 24,
              background: 'rgba(18,21,22,.94)',
              boxShadow: '0 36px 80px rgba(0,0,0,.45)',
            }}
          >
            <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,.1)', color: '#9ca3a9', fontSize: 15 }}>
              Obra Palermo · ahora
            </div>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: 18, background: '#111a17' }}>
              <div style={{ alignSelf: 'flex-end', width: 228, display: 'flex', flexDirection: 'column', padding: 14, borderRadius: '14px 3px 14px 14px', background: '#15634a' }}>
                <div style={{ color: '#baf0d7', fontSize: 13 }}>Nota de voz recibida</div>
                <div style={{ marginTop: 12, fontSize: 17, lineHeight: 1.35 }}>Terminamos las cañerías del segundo piso.</div>
                <div style={{ marginTop: 12, color: 'rgba(255,255,255,.58)', fontSize: 12, textAlign: 'right' }}>08:41 · recibido</div>
              </div>
              <div style={{ width: 242, display: 'flex', flexDirection: 'column', marginTop: 18, padding: 14, borderRadius: '3px 14px 14px 14px', background: '#242d2a' }}>
                <div style={{ color: '#f28a42', fontSize: 13, fontWeight: 700 }}>Procesado por ObraSaaS</div>
                <div style={{ marginTop: 8, color: '#d4d8d6', fontSize: 16, lineHeight: 1.4 }}>Evidencia vinculada. Cambio pendiente de aprobación.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', color: '#8fdcaf', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, display: 'flex', borderRadius: 8, background: '#60d394' }} />
                Registro trazable
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
