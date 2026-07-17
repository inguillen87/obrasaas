import {
  OBRA_SAAS_STRUCTURE_PATH,
  OBRA_SAAS_TRACE_PATH,
} from './brand-geometry';
import styles from './brand-logo.module.css';

const SUPPORTED_VARIANTS = new Set(['app', 'auto', 'dark', 'inverse', 'mono']);

function variantClassName(variant) {
  const normalized = SUPPORTED_VARIANTS.has(variant) ? variant : 'auto';
  return styles[`variant${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`];
}

export function ObraSaasMark({
  animate = false,
  className = '',
  size = 32,
  variant = 'auto',
}) {
  const appVariant = variant === 'app';
  const mark = (
    <>
      <path className={styles.structure} d={OBRA_SAAS_STRUCTURE_PATH} />
      <path
        className={styles.trace}
        d={OBRA_SAAS_TRACE_PATH}
        fill="none"
        pathLength="1"
        strokeWidth="7"
      />
    </>
  );

  return (
    <svg
      aria-hidden="true"
      className={`${styles.mark} ${variantClassName(variant)} ${animate ? styles.animated : ''} ${className}`.trim()}
      height={size}
      viewBox="0 0 64 64"
      width={size}
    >
      {appVariant ? (
        <>
          <rect className={styles.appTile} width="64" height="64" rx="14" />
          <g transform="translate(5.12 5.12) scale(.84)">{mark}</g>
        </>
      ) : mark}
    </svg>
  );
}

export function ObraSaasLogo({
  className = '',
  markClassName = '',
  markSize = 32,
  variant = 'auto',
  wordmarkClassName = '',
}) {
  return (
    <span className={`${styles.lockup} ${className}`.trim()}>
      <ObraSaasMark
        animate
        className={markClassName}
        size={markSize}
        variant={variant}
      />
      <span className={`${styles.wordmark} ${wordmarkClassName}`.trim()}>
        <strong>Obra</strong><span>SaaS</span>
      </span>
    </span>
  );
}
