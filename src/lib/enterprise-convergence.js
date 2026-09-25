export const ENTERPRISE_CONVERGENCE_VERSION = 'c2-2026-09-25';

export const MASTER_ONLY_ROUTE_CONVERGENCE = Object.freeze([
  { legacy: '/api-docs', status: 'pending', reason: 'La documentación pública de master todavía no tiene una superficie enterprise equivalente.' },
  { legacy: '/bim', status: 'pending', reason: 'El gemelo IFC/4D requiere conectar archivos y progreso reales antes de recuperar su UI.' },
  { legacy: '/calendario', status: 'pending', reason: 'Calendario no equivale sólo a replanificar; falta una superficie canónica única.' },
  { legacy: '/certificacion', status: 'pending', reason: 'Hay contratos y certificados reales, pero falta la pantalla enterprise equivalente completa.' },
  { legacy: '/compliance', status: 'pending', reason: 'Privacidad y auditoría reales no sustituyen por sí solas el tablero normativo de master.' },
  { legacy: '/coordinacion', status: 'pending', reason: 'Ejecución y evidencias existen, pero no reproducen todavía el lienzo georreferenciado.' },
  { legacy: '/costos', status: 'alias', target: '/dashboard/budgets', label: 'Presupuesto & costos', phase: 'c2-real-ui' },
  { legacy: '/cronograma', status: 'alias', target: '/dashboard?tab=sec-gantt', label: 'Cronograma' },
  { legacy: '/documentos', status: 'pending', reason: 'No existe aún un gestor documental enterprise equivalente al módulo visual de master.' },
  { legacy: '/ejecutivo', status: 'pending', reason: 'El dashboard operativo no reemplaza todavía el centro ejecutivo CEO de master.' },
  { legacy: '/libro-obra', status: 'alias', target: '/dashboard/progress', label: 'Libro de Obra & evidencia', phase: 'c2-real-ui' },
  { legacy: '/licitaciones', status: 'pending', reason: 'Compras reales no equivalen al proceso de licitación y matriz de oferentes.' },
  { legacy: '/marketplace', status: 'alias', target: '/dashboard/purchases', label: 'Marketplace & compras', phase: 'c2-real-ui' },
  { legacy: '/onboarding', status: 'alias', target: '/dashboard/getting-started', label: 'Puesta en marcha' },
  { legacy: '/planos', status: 'pending', reason: 'Falta conectar el visor y punch list de master al dominio real de evidencias/incidencias.' },
  { legacy: '/portal', status: 'pending', reason: 'No se expone el portal de inversores hasta definir publicación y permisos externos.' },
  { legacy: '/poster', status: 'pending', reason: 'Superficie promocional; no bloquea el producto operativo.' },
  { legacy: '/pricing', status: 'pending', reason: 'Pricing público requiere contratos comerciales y consumo medido antes de converger.' },
  { legacy: '/qa-report', status: 'pending', reason: 'Reporte QA debe surgir de inspecciones reales, no de datos de demostración.' },
  { legacy: '/sostenibilidad', status: 'pending', reason: 'No hay aún dominio enterprise equivalente verificado para la UI de sostenibilidad.' },
]);

export function enterpriseAliasFor(pathname) {
  const match = MASTER_ONLY_ROUTE_CONVERGENCE.find(row => row.legacy === pathname);
  return match?.status === 'alias' ? match.target : null;
}
