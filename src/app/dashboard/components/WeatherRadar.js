"use client";

export default function WeatherRadar({ weatherTelemetry, setWeatherTelemetry, selectedForecastDay, setSelectedForecastDay, state, addToast }) {
  return (
    <div className="glass-panel-premium dashboard-card-hover" style={{ marginTop: '24px' }}>
      <div className="section-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: '#38bdf8' }}>
            <i className="fa-solid fa-cloud-sun-rain"></i> Telemetría Meteorológica &amp; Radar de Hormigonado
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Auditoría satelital en tiempo real para colado de losas y revoques en <strong>{state.projectConfig?.name || 'Torre Palermo Soho'} ({state.projectConfig?.city || 'CABA'})</strong>. Normas IRAM 1666 y CIRSOC 201.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={async () => {
              try {
                const lat = state.projectConfig?.latitude || -34.5886;
                const lon = state.projectConfig?.longitude || -58.4302;
                const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(state.projectConfig?.city || '')}&name=${encodeURIComponent(state.projectConfig?.name || '')}`);
                const d = await res.json();
                if (setWeatherTelemetry) setWeatherTelemetry(d);
                if (addToast) addToast(`🌦️ Radar satelital actualizado para ${state.projectConfig?.name}`, 'info');
              } catch(e) {
                console.error(e);
              }
            }}
            className="btn btn-sm"
            style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '6px' }}
          >
            <i className="fa-solid fa-rotate"></i> Actualizar Satélite
          </button>
          <span className={`badge ${weatherTelemetry?.concreteAdvisory?.pouringBadge || 'badge-success'}`}>
            <i className="fa-solid fa-tower-broadcast"></i> {weatherTelemetry?.concreteAdvisory?.pouringStatus || 'APTO_COLADO'}
          </span>
        </div>
      </div>

      {/* Weather Stats Grid */}
      <div className="grid-4" style={{ gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Temperatura Actual</span>
          <strong style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 900 }}>{weatherTelemetry?.current?.temp ?? 21}°C</strong>
          <span style={{ fontSize: '0.65rem', color: 'var(--success)', display: 'block' }}>Rango Normativo (5°-32°C)</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Riesgo de Lluvia</span>
          <strong style={{ fontSize: '1.4rem', color: (weatherTelemetry?.current?.rainProb ?? 10) > 40 ? '#ef4444' : '#22c55e', fontWeight: 900 }}>
            {weatherTelemetry?.current?.rainProb ?? 12}%
          </strong>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Humedad: {weatherTelemetry?.current?.humidity ?? 60}%</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Viento &amp; Ráfagas</span>
          <strong style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 900 }}>{weatherTelemetry?.current?.windSpeed ?? 14} km/h</strong>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Ráfagas: {weatherTelemetry?.current?.windGusts ?? 20} km/h</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Seguridad Grúa Torre</span>
          <strong style={{ fontSize: '1.2rem', color: '#22c55e', fontWeight: 900 }}>{weatherTelemetry?.current?.craneStatus || 'OPERATIVA'}</strong>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>Límite IRAM 3920: 50 km/h</span>
        </div>
      </div>

      {/* Concrete Advisory Box */}
      <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid #0284c7', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}><i className="fa-solid fa-clipboard-check"></i> Dictamen Técnico de Colado (IA ConTech):</strong>
          <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>Ventana Óptima: {weatherTelemetry?.concreteAdvisory?.optimalWindow || '08:00 - 13:30 hs'}</span>
        </div>
        <p style={{ color: 'var(--text-primary)', fontSize: '0.8rem', margin: 0 }}>
          {weatherTelemetry?.concreteAdvisory?.advisoryText || 'Condiciones favorables para llenado de estructuras de hormigón armado y revoques.'}
        </p>
      </div>

      {/* 7-Day Forecast Radar Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
        {(weatherTelemetry?.forecast7Days || []).slice(0, 5).map((fDay, fIdx) => (
          <div 
            key={fIdx} 
            onClick={() => {
              if (setSelectedForecastDay) setSelectedForecastDay(fDay);
              if (addToast) addToast(`📅 Pronóstico ${fDay.date}: ${fDay.maxTemp}°C / ${fDay.minTemp}°C • Estado: ${fDay.status}`, 'info');
            }}
            style={{ background: selectedForecastDay?.date === fDay.date ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0,0,0,0.25)', border: `1px solid ${fDay.color}44`, borderRadius: '8px', padding: '8px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease' }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 700 }}>{fDay.date}</span>
            <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'block', margin: '2px 0' }}>{fDay.maxTemp}° / {fDay.minTemp}°</strong>
            <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: `${fDay.color}22`, color: fDay.color, fontWeight: 700 }}>
              {fDay.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
