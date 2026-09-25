const HINTS = Object.freeze({
  'field-mobile': ['Registrar desde el terreno', 'parte faltante incidencia mejora celular movil'],
  summary: ['Resumen de la obra activa', 'inicio resumen hoy direccion centro operaciones pendientes ciclos'],
  whatsapp: ['Operación del canal de obra', 'mensajes chat terreno'],
  inbox: ['Conversaciones y entregas', 'whatsapp chat mensajes audio voz'],
  gantt: ['Tareas, dependencias y línea base', 'planificacion gantt tareas fechas calendario'],
  approvals: ['Propuestas que requieren una decisión', 'pendientes autorizar revisar'],
  attendance: ['Marcaciones y jornadas', 'fichaje entrada salida turnos asistencia'],
  execution: ['Equipos, responsables y restricciones', 'cuadrillas blockers bloqueo faltantes equipos'],
  inspections: ['Controles de calidad y dictámenes', 'calidad seguridad qaqc inspeccion aprobar'],
  progress: ['Partes y evidencia vinculada a tareas', 'bitacora avance fotos imagenes evidencia parte'],
  measurements: ['Cantidades de avance revisables', 'mediciones cantidades avance'],
  contracts: ['Alcance contractual y valores', 'contrato sov valores certificacion'],
  notifications: ['Avisos de la obra activa', 'alertas avisos notificaciones'],
  'extra-work': ['Cambios y trabajos adicionales', 'extra adicionales cambios'],
  replan: ['Evaluar alternativas de planificación', 'escenarios replanificacion impacto'],
  cash: ['Movimientos de caja de obra', 'gastos caja efectivo'],
  activity: ['Actividad y auditoría de la obra', 'historial auditoria bitacora eventos'],
  people: ['Personas de la obra activa', 'personal personas trabajadores operarios'],
  projects: ['Seleccionar y administrar obras', 'proyectos portfolio empresa obras'],
  report: ['Síntesis operativa para seguimiento', 'reporte informe semanal'],
  budgets: ['Presupuesto y control de costos', 'presupuesto computo costos'],
  purchases: ['Abastecimiento y recepción', 'compras materiales remitos proveedores ordenes'],
  payables: ['Obligaciones y documentos a pagar', 'facturas cuentas pagos'],
  activation: ['Preparar la operación paso a paso', 'inicio configuracion puesta marcha ayuda'],
  team: ['Miembros y permisos de acceso', 'roles equipo invitar acceso permisos'],
  integrations: ['Estado y configuración de los canales', 'meta whatsapp conectar integracion'],
  privacy: ['Solicitudes y controles de privacidad', 'datos privacidad'],
  labs: ['Capacidades en evaluación', 'laboratorio demo exploracion'],
  superadmin: ['Administración técnica de plataforma', 'plataforma superadmin'],
});
export function navigationSearchText(value) {
  return String(value ?? '').slice(0, 300).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function buildNavigationCatalog(groups, permissions = {}) {
  const seen = new Set(), catalog = [];
  for (const group of groups || []) {
    for (const destination of group.destinations || []) {
      if (destination.permission && permissions[destination.permission] !== true) continue;
      if (seen.has(destination.key) || !Object.hasOwn(HINTS, destination.key)) continue;
      if (typeof destination.href !== 'string' || !/^\/(dashboard(?:[/?#]|$)|superadmin(?:[/?#]|$))/.test(destination.href) || /[\s\\]/.test(destination.href)) continue;
      seen.add(destination.key);
      const [description, keywords] = HINTS[destination.key];
      catalog.push({ key: destination.key, href: destination.href, label: destination.label, icon: destination.icon,
        group: group.label, description, hardNavigation: destination.hardNavigation === true,
        searchText: navigationSearchText(destination.label + ' ' + keywords + ' ' + description) });
    }
  }
  return catalog;
}
export function searchWorkspaceNavigation(catalog, query) {
  const terms = navigationSearchText(query).split(' ').filter(Boolean);
  if (!terms.length) return catalog;
  return catalog.filter(item => terms.every(term => item.searchText.includes(term))).map((item, index) => ({ item, index,
    score: navigationSearchText(item.label) === terms.join(' ') ? 3 : navigationSearchText(item.label).startsWith(terms.join(' ')) ? 2 : 1,
  })).sort((a, b) => b.score - a.score || a.index - b.index).map(match => match.item);
}
