import { getAppState, saveAppState } from '@/lib/db';
import { appendAuditTransaction } from '@/lib/auditLedger';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const state = await getAppState();
        
        // Dynamic documents combining uploaded files, remitos from WhatsApp, and site photos
        const baseDocs = state.documents || [
            { id: 'doc-1', name: 'PL-ARQ-01_PlantaBaja.pdf', category: 'planos', folder: 'Planos & Láminas', version: 'v3', uploader: 'Arq. Marcelo', date: 'Hoy', size: '4.2 MB', source: 'Portal Técnico' },
            { id: 'doc-2', name: 'PL-EST-04_LosaSobrePB.dwg', category: 'planos', folder: 'Planos & Láminas', version: 'v1', uploader: 'Arq. Victoria', date: 'Ayer', size: '12.5 MB', source: 'CIRSOC 201' },
            { id: 'doc-3', name: 'ET-Hormigon-H21.pdf', category: 'especificaciones', folder: 'Especificaciones Técnicas', version: 'v1', uploader: 'Arq. Victoria', date: 'Hace 3 días', size: '1.2 MB', source: 'Laboratorio' },
            { id: 'doc-4', name: 'PP-Presupuesto_TorrePalermo.xlsx', category: 'presupuesto', folder: 'Cómputo & Presupuesto', version: 'v2', uploader: 'Marcelo Guillén', date: 'Hace 1 semana', size: '2.8 MB', source: 'Cómputo CAC' }
        ];

        // Ingest remitos received via WhatsApp into documents automatically
        const remitoDocs = (state.remitos || []).map(r => ({
            id: `doc-rem-${r.id}`,
            name: `${r.proveedor.replace(/\s+/g, '_')}_${r.comprobanteNro || 'Remito'}.pdf`,
            category: 'remitos',
            folder: 'Remitos & Facturas AFIP',
            version: 'v1',
            uploader: `${r.solicitante || 'Capataz'} (WhatsApp)`,
            date: r.fecha || 'Hoy',
            size: '1.1 MB',
            source: 'WhatsApp OCR AFIP',
            metadata: {
                cuit: r.cuit,
                cae: r.caeNumber,
                monto: r.montoTotal
            }
        }));

        // Ingest photos from WhatsApp into photo documentation
        const photoDocs = (state.sitePhotos || []).map(p => ({
            id: `doc-ph-${p.id}`,
            name: `Inspeccion_${(p.phase || 'Obra').replace(/\s+/g, '_')}_${p.timestamp?.split(',')[0] || 'Hoy'}.jpg`,
            category: 'fotos',
            folder: 'Registro Fotográfico',
            version: 'v1',
            uploader: p.reporter || 'Operario',
            date: p.timestamp || 'Hoy',
            size: '2.4 MB',
            source: 'WhatsApp Vision IA',
            photoUrl: p.photoUrl
        }));

        const allDocs = [...baseDocs, ...remitoDocs, ...photoDocs];

        return Response.json({
            success: true,
            count: allDocs.length,
            documents: allDocs,
            submittals: state.submittals || [
                { id: 's1', title: 'Muestra de Porcelanato Ilva Soho 60x120', category: 'Terminaciones', submittedBy: 'Constructora SUR', date: 'Hoy', status: 'APROBADO', reviewer: 'Arq. Victoria', responseDate: 'Hoy', observations: 'Aprobado para áreas comunes y pasillos conforme CIRSOC.' },
                { id: 's2', title: 'Prototipo de Carpintería DVH Aluar', category: 'Carpinterías', submittedBy: 'Aberturas López', date: 'Ayer', status: 'EN_REVISION', reviewer: 'Marcelo Guillén', responseDate: '-', observations: 'Pendiente entrega flete.' },
                { id: 's3', title: 'Especificación de Membrana Megaflex', category: 'Aislaciones', submittedBy: 'Techos SRL', date: 'Hace 3 días', status: 'APROBADO_CON_OBSERVACIONES', reviewer: 'Arq. Victoria', responseDate: 'Ayer', observations: 'Asegurar solape mínimo de 15cm.' }
            ]
        });
    } catch (err) {
        console.error('Error fetching documents:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { name, category, folder, size, uploader, source, contentBase64 } = body;

        if (!name) {
            return Response.json({ success: false, error: 'Document name is required' }, { status: 400 });
        }

        const state = await getAppState();
        state.documents = state.documents || [];

        const newDoc = {
            id: `doc-${Date.now()}`,
            name,
            category: category || 'planos',
            folder: folder || 'Planos & Láminas',
            version: 'v1',
            uploader: uploader || 'Administrador',
            date: new Date().toLocaleDateString('es-AR'),
            size: size || '1.5 MB',
            source: source || 'Carga Web Directa'
        };

        state.documents.unshift(newDoc);

        // Audit trail
        state.auditLedger = appendAuditTransaction(state.auditLedger, {
            action: 'DOCUMENTO_TECNICO_SUBIDO',
            actor: newDoc.uploader,
            details: { name: newDoc.name, folder: newDoc.folder, category: newDoc.category, obra: state.projectConfig?.name }
        });

        // Add incident to feed
        state.incidents = state.incidents || [];
        state.incidents.unshift({
            id: `inc-doc-${Date.now()}`,
            title: `Nuevo Documento: ${newDoc.name}`,
            description: `${newDoc.uploader} cargó ${newDoc.name} en la carpeta ${newDoc.folder}.`,
            type: 'info',
            badge: 'Documento',
            timestamp: `Hoy, ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
            reporter: newDoc.uploader,
            icon: 'fa-solid fa-file-lines'
        });

        await saveAppState(state);

        return Response.json({
            success: true,
            document: newDoc,
            message: 'Documento registrado y transmitido por SSE en tiempo real'
        });
    } catch (err) {
        console.error('Error uploading document:', err);
        return Response.json({ success: false, error: err.message }, { status: 500 });
    }
}
