// NLP Intent Engine for WhatsApp "Copiloto de Obra"
// Matches natural language to structured intents without external API dependency

const intentPatterns = [
    // Attendance/Check-in
    { intent: 'checkin', patterns: ['llegue', 'llegué', 'entre', 'fichar', 'presente', 'estoy en obra', 'ya estoy', 'vine', 'arranque', 'arranqué'], command: '1' },
    
    // Task progress
    { intent: 'progress', patterns: ['terminamos', 'terminé', 'avance', 'completamos', 'avanzamos', 'listo', 'al 100', 'progreso', 'hicimos', 'ya esta'], command: '2' },
    
    // Incident report
    { intent: 'incident', patterns: ['fuga', 'rotura', 'fisura', 'problema', 'alerta', 'urgente', 'accidente', 'peligro', 'caida', 'caída', 'derrumbe', 'incidente', 'se rompio', 'se rompió'], command: '3' },
    
    // Material delay
    { intent: 'delay', patterns: ['demora', 'no llego', 'no llegó', 'falta material', 'sin material', 'proveedor', 'entrega', 'demorado', 'no trajo', 'falta cemento', 'falta hierro'], command: '4' },
    
    // Expense/Receipt
    { intent: 'expense', patterns: ['gaste', 'gasté', 'remito', 'factura', 'ticket', 'compre', 'compré', 'ferreteria', 'ferretería', 'caja chica', 'pague', 'pagué'], command: '5' },
    
    // Medical leave
    { intent: 'medical', patterns: ['licencia', 'medica', 'médica', 'certificado medico', 'enfermo', 'doctor', 'turno medico', 'accidente laboral'], command: '6' },
    
    // Supervision/KYC
    { intent: 'supervision', patterns: ['cuadrilla', 'supervision', 'supervisión', 'kyc', 'personal', 'operarios', 'quienes estan', 'quiénes están', 'cuantos hay', 'cuántos hay'], command: '1' },
    
    // Budget/Costs
    { intent: 'budget', patterns: ['costo', 'presupuesto', 'plata', 'cuanto gastamos', 'cuánto gastamos', 'rubro', 'cuanto sale', 'cuánto sale', 'cuanto va', 'cuánto va', 'ejecutado'], command: '10' },
    
    // Certification
    { intent: 'certification', patterns: ['certificacion', 'certificación', 'certificado', 'certificar', 'certific'], command: '11' },
    
    // Plan/Schedule
    { intent: 'plan', patterns: ['quincena', 'plan', 'cronograma', 'que nos toca', 'qué nos toca', 'que hacemos', 'qué hacemos', 'semana', 'proxima', 'próxima'], command: '6' },
    
    // Audit/Geocerca
    { intent: 'audit', patterns: ['geocerca', 'auditoria', 'auditoría', 'art', 'satelital', 'gps'], command: '8' },
    
    // Libro de Obra
    { intent: 'libro', patterns: ['libro', 'bitacora', 'bitácora', 'registro diario', 'ley 22250', 'acta'], command: '9' },
    
    // Weather
    { intent: 'weather', patterns: ['clima', 'lluvia', 'llueve', 'temperatura', 'viento', 'pronostico', 'pronóstico', 'hormigon', 'hormigón', 'colar'], command: '8' },
    
    // Greetings
    { intent: 'greeting', patterns: ['hola', 'buenas', 'buen dia', 'buen día', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches', 'que tal', 'qué tal'], command: 'menu' },
    
    // Help
    { intent: 'help', patterns: ['ayuda', 'menu', 'menú', 'opciones', 'que puedo hacer', 'qué puedo hacer', 'comandos'], command: 'menu' },
    
    // Provider management
    { intent: 'provider', patterns: ['proveedor', 'abertura', 'entrega', 'confirmar entrega', 'cotizacion', 'cotización', 'presupuesto proveedor'], command: '5' }
];

/**
 * Detect intent from natural language text
 * @param {string} text - Normalized message text
 * @returns {{ intent: string, command: string, confidence: number } | null}
 */
export function detectIntent(text) {
    const normalized = text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .trim();
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const pattern of intentPatterns) {
        let matchCount = 0;
        for (const p of pattern.patterns) {
            const normalizedPattern = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normalized.includes(normalizedPattern)) {
                matchCount++;
            }
        }
        
        if (matchCount > 0) {
            const score = matchCount / pattern.patterns.length;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = {
                    intent: pattern.intent,
                    command: pattern.command,
                    confidence: Math.min(score * 2, 1) // Scale up since partial matches are common
                };
            }
        }
    }
    
    return bestMatch;
}

/**
 * Extract numeric values from text (for expense amounts, progress %, etc.)
 * @param {string} text 
 * @returns {{ amounts: number[], percentages: number[] }}
 */
export function extractNumbers(text) {
    const amounts = [];
    const percentages = [];
    
    // Match percentages (e.g., "80%", "al 100")
    const pctMatches = text.match(/(\d+)\s*%|al\s+(\d+)/gi) || [];
    for (const m of pctMatches) {
        const num = parseInt(m.replace(/[^\d]/g, ''), 10);
        if (num >= 0 && num <= 100) percentages.push(num);
    }
    
    // Match currency amounts (e.g., "$18.500", "18500 pesos", "$18,500")
    const amtMatches = text.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+)/g) || [];
    for (const m of amtMatches) {
        const cleaned = m.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (num > 100 && num < 100000000) amounts.push(num);
    }
    
    return { amounts, percentages };
}

/**
 * Extract worker name mentions from text
 * @param {string} text 
 * @param {Array} workerRegistry - list of known workers
 * @returns {string[]} matched worker names
 */
export function extractWorkerMentions(text, workerRegistry) {
    const normalized = text.toLowerCase();
    const matches = [];
    
    for (const worker of workerRegistry) {
        const names = (worker.name || '').toLowerCase().split(' ');
        // Check if any part of the worker's name is mentioned
        if (names.some(n => n.length > 2 && normalized.includes(n))) {
            matches.push(worker.name);
        }
    }
    
    return matches;
}

/**
 * Extract task mentions from text
 * @param {string} text 
 * @param {Object} tasks - task map from state
 * @returns {Array<{id: string, name: string}>}
 */
export function extractTaskMentions(text, tasks) {
    const normalized = text.toLowerCase();
    const matches = [];
    
    for (const [id, task] of Object.entries(tasks || {})) {
        const taskName = (task.name || '').toLowerCase();
        const keywords = taskName.split(/\s+/).filter(w => w.length > 3);
        if (keywords.some(k => normalized.includes(k))) {
            matches.push({ id, name: task.name });
        }
    }
    
    return matches;
}
