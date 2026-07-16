'use client';

import { useMemo, useState } from 'react';
import {
  createStockpile,
  receiveStockpile,
  StockpileInputError,
  stockpileStatus,
  updateStockpile,
} from '@/lib/stockpiles';
import styles from './stockpile-panel.module.css';
import { useModalFocus } from './use-modal-focus';

const EMPTY_MATERIAL = Object.freeze({
  name: '',
  unit: '',
  current: '0',
  min: '0',
  max: '',
});

function formatQuantity(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('es-AR', { maximumFractionDigits: 6 })
    : '0';
}

function materialDraft(item) {
  return {
    name: String(item?.name || ''),
    unit: String(item?.unit || ''),
    current: String(Number(item?.current) || 0),
    min: String(Number(item?.min) || 0),
    max: String(Number(item?.max) || ''),
  };
}

function modalCopy(mode) {
  if (mode === 'edit') return { eyebrow: 'Configuración', title: 'Editar material' };
  if (mode === 'receive') return { eyebrow: 'Movimiento de stock', title: 'Registrar recepción' };
  return { eyebrow: 'Nuevo acopio', title: 'Agregar material' };
}

export default function StockpilePanel({
  stockpiles,
  canManage,
  createId,
  onCommit,
}) {
  const entries = useMemo(
    () => Object.entries(stockpiles && typeof stockpiles === 'object' ? stockpiles : {}),
    [stockpiles],
  );
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState(EMPTY_MATERIAL);
  const [receipt, setReceipt] = useState({ materialId: '', quantity: '', reference: '' });
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);

  const criticalCount = entries.filter(([, item]) => Number(item.current) < Number(item.min)).length;
  const healthyCount = entries.length - criticalCount;
  const selectedReceipt = stockpiles?.[receipt.materialId] || null;
  const receiptCapacity = selectedReceipt
    ? Math.max(0, Number(selectedReceipt.max) - Number(selectedReceipt.current))
    : 0;

  const closeModal = () => {
    if (pending) return;
    setModal(null);
    setFormError('');
  };

  const { captureReturnFocus, dialogRef } = useModalFocus({
    locked: pending,
    onRequestClose: closeModal,
    open: Boolean(modal),
  });

  const openCreate = () => {
    if (!canManage) return;
    setDraft({ ...EMPTY_MATERIAL });
    setFormError('');
    captureReturnFocus();
    setModal({ mode: 'create', materialId: null });
  };

  const openEdit = (materialId, item) => {
    if (!canManage) return;
    setDraft(materialDraft(item));
    setFormError('');
    captureReturnFocus();
    setModal({ mode: 'edit', materialId });
  };

  const openReceive = (materialId = entries[0]?.[0] || '') => {
    if (!canManage || !materialId) return;
    setReceipt({ materialId, quantity: '', reference: '' });
    setFormError('');
    captureReturnFocus();
    setModal({ mode: 'receive', materialId });
  };

  const updateDraft = (field) => (event) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
    if (formError) setFormError('');
  };

  const updateReceipt = (field) => (event) => {
    setReceipt((current) => ({ ...current, [field]: event.target.value }));
    if (formError) setFormError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!modal || pending || !canManage) return;
    setFormError('');
    setPending(true);

    try {
      let nextCatalog;
      let action;
      if (modal.mode === 'create') {
        const materialId = createId();
        nextCatalog = createStockpile(stockpiles, materialId, draft);
        action = { type: 'created', materialId };
      } else if (modal.mode === 'edit') {
        nextCatalog = updateStockpile(stockpiles, modal.materialId, draft);
        action = { type: 'updated', materialId: modal.materialId };
      } else {
        const reference = receipt.reference.trim();
        if (reference.length > 120) {
          throw new StockpileInputError('La referencia admite hasta 120 caracteres.');
        }
        nextCatalog = receiveStockpile(stockpiles, receipt.materialId, receipt.quantity);
        action = {
          type: 'received',
          materialId: receipt.materialId,
          quantity: Number(receipt.quantity),
          reference,
        };
      }

      const saved = await onCommit(nextCatalog, action);
      if (!saved) {
        setFormError('El cambio no se guardó. Revisá el aviso de sincronización e intentá nuevamente.');
        return;
      }

      const item = nextCatalog[action.materialId];
      setNotice(
        action.type === 'received'
          ? `Recepción registrada: ${formatQuantity(action.quantity)} ${item.unit} de ${item.name}.`
          : action.type === 'updated'
            ? `${item.name} quedó actualizado.`
            : `${item.name} quedó disponible para controlar y recibir stock.`,
      );
      setModal(null);
    } catch (error) {
      setFormError(
        error instanceof StockpileInputError
          ? error.message
          : 'No se pudo preparar el cambio de acopio.',
      );
    } finally {
      setPending(false);
    }
  };

  const dialogCopy = modalCopy(modal?.mode);

  return (
    <section className={styles.panel} aria-labelledby="stockpile-heading">
      <header className={styles.header}>
        <div className={styles.heading}>
          <span>Abastecimiento de obra</span>
          <h3 id="stockpile-heading">
            <i className="fa-solid fa-boxes-stacked" aria-hidden="true" />
            Acopios y recepción de materiales
          </h3>
          <p>Controlá existencias, mínimos operativos y cada ingreso sin perder trazabilidad.</p>
        </div>
        {canManage && (
          <div className={styles.headerActions}>
            {entries.length > 0 && (
              <button type="button" className={styles.secondaryButton} onClick={() => openReceive()}>
                <i className="fa-solid fa-truck-ramp-box" aria-hidden="true" />
                Registrar recepción
              </button>
            )}
            <button type="button" className={styles.primaryButton} onClick={openCreate}>
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Agregar material
            </button>
          </div>
        )}
      </header>

      <div className={styles.metrics} aria-label="Resumen de acopios">
        <div>
          <span>Materiales controlados</span>
          <strong>{entries.length}</strong>
        </div>
        <div className={criticalCount > 0 ? styles.riskMetric : ''}>
          <span>Debajo del mínimo</span>
          <strong>{criticalCount}</strong>
        </div>
        <div>
          <span>Stock operativo</span>
          <strong>{healthyCount}</strong>
        </div>
      </div>

      {notice && (
        <div className={styles.notice} role="status">
          <i className="fa-solid fa-circle-check" aria-hidden="true" />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Cerrar confirmación">×</button>
        </div>
      )}

      {!canManage && (
        <div className={styles.readOnly}>
          <i className="fa-solid fa-eye" aria-hidden="true" />
          Tu rol puede consultar los acopios. La edición y las recepciones requieren permiso de gestión.
        </div>
      )}

      {entries.length === 0 ? (
        <div className={styles.emptyState}>
          <span><i className="fa-solid fa-box-open" aria-hidden="true" /></span>
          <h4>Empezá por el primer material</h4>
          <p>Definí la unidad, el mínimo operativo y la capacidad. Después vas a poder registrar cada recepción.</p>
          {canManage && (
            <button type="button" className={styles.primaryButton} onClick={openCreate}>
              <i className="fa-solid fa-plus" aria-hidden="true" />
              Agregar primer material
            </button>
          )}
        </div>
      ) : (
        <div className={styles.cards}>
          {entries.map(([materialId, item]) => {
            const current = Number(item.current) || 0;
            const minimum = Number(item.min) || 0;
            const maximum = Number(item.max) || 0;
            const percentage = maximum > 0 ? Math.min(100, (current / maximum) * 100) : 0;
            const isCritical = current < minimum;
            const status = stockpileStatus(current, minimum);

            return (
              <article key={materialId} className={`${styles.card} ${isCritical ? styles.criticalCard : ''}`}>
                <div className={styles.cardTopline}>
                  <div>
                    <span>Material</span>
                    <h4>{item.name}</h4>
                  </div>
                  <span className={`${styles.status} ${isCritical ? styles.criticalStatus : styles.healthyStatus}`}>
                    {status}
                  </span>
                </div>

                <div className={styles.quantity}>
                  <strong>{formatQuantity(current)}</strong>
                  <span>{item.unit}</span>
                </div>
                <div className={styles.levelLabels}>
                  <span>Mínimo {formatQuantity(minimum)}</span>
                  <span>Capacidad {formatQuantity(maximum)}</span>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-label={`Stock de ${item.name}`}
                  aria-valuemin="0"
                  aria-valuemax={maximum}
                  aria-valuenow={current}
                >
                  <span
                    className={isCritical ? styles.criticalProgress : styles.healthyProgress}
                    style={{ width: `${percentage}%` }}
                  />
                  {maximum > 0 && (
                    <i
                      className={styles.minimumMarker}
                      style={{ left: `${Math.min(100, (minimum / maximum) * 100)}%` }}
                      title="Mínimo operativo"
                    />
                  )}
                </div>

                {canManage && (
                  <div className={styles.cardActions}>
                    <button type="button" onClick={() => openEdit(materialId, item)}>
                      <i className="fa-solid fa-pen" aria-hidden="true" />
                      Editar
                    </button>
                    <button type="button" className={styles.receiveButton} onClick={() => openReceive(materialId)}>
                      <i className="fa-solid fa-arrow-down" aria-hidden="true" />
                      Recibir stock
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeModal();
          }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stockpile-dialog-title"
          >
            <header>
              <div>
                <span>{dialogCopy.eyebrow}</span>
                <h2 id="stockpile-dialog-title">{dialogCopy.title}</h2>
              </div>
              <button type="button" onClick={closeModal} disabled={pending} aria-label="Cerrar ventana">×</button>
            </header>

            <form onSubmit={submit}>
              {modal.mode === 'receive' ? (
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    <span>Material</span>
                    <select data-autofocus value={receipt.materialId} onChange={updateReceipt('materialId')} disabled={pending}>
                      {entries.map(([materialId, item]) => (
                        <option key={materialId} value={materialId}>{item.name} · {item.unit}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Cantidad recibida</span>
                    <input
                      type="number"
                      min="0.000001"
                      max={receiptCapacity || undefined}
                      step="any"
                      inputMode="decimal"
                      value={receipt.quantity}
                      onChange={updateReceipt('quantity')}
                      placeholder="0"
                      disabled={pending}
                    />
                  </label>
                  <div className={styles.capacitySummary}>
                    <span>Capacidad disponible</span>
                    <strong>{formatQuantity(receiptCapacity)} {selectedReceipt?.unit || ''}</strong>
                  </div>
                  <label className={styles.fullField}>
                    <span>Referencia o remito <small>Opcional</small></span>
                    <input
                      type="text"
                      value={receipt.reference}
                      onChange={updateReceipt('reference')}
                      maxLength="120"
                      placeholder="Ej. REM-004-98122"
                      disabled={pending}
                    />
                  </label>
                </div>
              ) : (
                <div className={styles.formGrid}>
                  <label className={styles.fullField}>
                    <span>Nombre del material</span>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={updateDraft('name')}
                      maxLength="160"
                      placeholder="Ej. Cemento CPC40"
                      data-autofocus
                      disabled={pending}
                    />
                  </label>
                  <label>
                    <span>Unidad de medida</span>
                    <input
                      type="text"
                      value={draft.unit}
                      onChange={updateDraft('unit')}
                      maxLength="40"
                      placeholder="Bolsas, m³, kg…"
                      disabled={pending}
                    />
                  </label>
                  <label>
                    <span>{modal.mode === 'create' ? 'Stock inicial' : 'Stock actual'}</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.current}
                      onChange={updateDraft('current')}
                      readOnly={modal.mode === 'edit'}
                      disabled={pending}
                    />
                    {modal.mode === 'edit' && <small>El stock cambia únicamente al registrar una recepción.</small>}
                  </label>
                  <label>
                    <span>Stock mínimo</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={draft.min}
                      onChange={updateDraft('min')}
                      disabled={pending}
                    />
                  </label>
                  <label>
                    <span>Capacidad máxima</span>
                    <input
                      type="number"
                      min="0.000001"
                      step="any"
                      inputMode="decimal"
                      value={draft.max}
                      onChange={updateDraft('max')}
                      placeholder="0"
                      disabled={pending}
                    />
                  </label>
                </div>
              )}

              {formError && <p className={styles.formError} role="alert">{formError}</p>}
              <footer className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={closeModal} disabled={pending}>Cancelar</button>
                <button type="submit" className={styles.primaryButton} disabled={pending}>
                  {pending && <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />}
                  {pending
                    ? 'Guardando…'
                    : modal.mode === 'receive'
                      ? 'Registrar recepción'
                      : modal.mode === 'edit'
                        ? 'Guardar cambios'
                        : 'Agregar material'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
