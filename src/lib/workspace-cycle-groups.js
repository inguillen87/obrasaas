const CYCLES = Object.freeze([
  { key: 'daily', label: 'Trabajo diario', description: 'Capturar, atender y decidir', keys: ['summary', 'field-mobile', 'inbox', 'whatsapp', 'approvals', 'notifications'] },
  { key: 'planning', label: 'Planificación y equipo', description: 'Preparar el trabajo y resolver restricciones', keys: ['gantt', 'execution', 'people', 'attendance', 'replan'] },
  { key: 'quality', label: 'Calidad y avance', description: 'Documentar, revisar y medir', keys: ['progress', 'inspections', 'measurements', 'extra-work'] },
  { key: 'supply', label: 'Abastecimiento y costos', description: 'Presupuestar, comprar y conciliar', keys: ['budgets', 'purchases', 'payables', 'cash', 'contracts'] },
  { key: 'control', label: 'Empresa y control', description: 'Dirigir, configurar y auditar', keys: ['projects', 'report', 'activity', 'team', 'integrations', 'activation', 'privacy'] },
  { key: 'explore', label: 'Exploración', description: 'Funciones en evaluación', keys: ['labs'] },
].map(cycle => Object.freeze({ ...cycle, keys: Object.freeze(cycle.keys) })));
const LABELS = Object.freeze({ execution: 'Cuadrillas y restricciones', activity: 'Historial y auditoría', contracts: 'Contratos y partidas', whatsapp: 'Canal de campo' });
// Reorganizes only destinations already authorized by the shell. Never grants access.
export function groupWorkspaceByCycle(destinations) {
  const available = new Map((destinations || []).map(item => [item.key, item]));
  const groups = CYCLES.map(cycle => ({ ...cycle, destinations: cycle.keys.flatMap(key => {
    const destination = available.get(key); if (!destination) return [];
    available.delete(key); return [{ ...destination, label: LABELS[key] || destination.label }];
  }) })).filter(group => group.destinations.length);
  // A future destination must not disappear merely because it lacks a cycle mapping.
  if (available.size) groups.push({ key: 'other', label: 'Otras secciones', description: 'Accesos disponibles', destinations: [...available.values()] });
  return groups;
}
export function workspaceCycleForDestination(key) { return CYCLES.find(cycle => cycle.keys.includes(key))?.key || 'other'; }
