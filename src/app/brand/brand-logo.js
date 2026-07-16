import Image from 'next/image';
import styles from './brand-logo.module.css';

const MARK_SOURCES = Object.freeze({
  app: '/brand/obrasaas-app-icon.svg',
  dark: '/brand/obrasaas-symbol.svg',
  inverse: '/brand/obrasaas-symbol-inverse.svg',
  mono: '/brand/obrasaas-symbol-mono.svg',
});

export function ObraSaasMark({
  className = '',
  preload = false,
  size = 32,
  variant = 'app',
}) {
  const source = MARK_SOURCES[variant] || MARK_SOURCES.app;
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={`${styles.mark} ${className}`.trim()}
      height={size}
      preload={preload}
      src={source}
      width={size}
    />
  );
}

export function ObraSaasLogo({
  className = '',
  markClassName = '',
  markSize = 32,
  preload = false,
  variant = 'app',
  wordmarkClassName = '',
}) {
  return (
    <span className={`${styles.lockup} ${className}`.trim()}>
      <ObraSaasMark
        className={markClassName}
        preload={preload}
        size={markSize}
        variant={variant}
      />
      <span className={`${styles.wordmark} ${wordmarkClassName}`.trim()}>
        <strong>Obra</strong><span>SaaS</span>
      </span>
    </span>
  );
}
