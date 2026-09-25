import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/lib/icons';

interface Props {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onBack?: () => void;
  width?: number;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Dialog modal: centrat pe desktop, ecran complet pe mobil. Escape închide, focusul intră în dialog. */
export function Dialog({ title, subtitle, onClose, onBack, width = 580, header, footer, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="dialog">
      <div className="dialog__scrim" onClick={onClose} />
      <div ref={ref} className="dialog__box" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={{ ['--dialog-w' as string]: `${width}px` }}>
        <div className="dialog__head">
          <div className="row gap-4 align-start">
            {onBack && (
              <button type="button" className="icon-btn" aria-label="Înapoi" onClick={onBack}>
                <Icon name="chevL" />
              </button>
            )}
            <div className="stack">
              <h2 className="dialog__title">{title}</h2>
              {subtitle && <span className="muted small">{subtitle}</span>}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label="Închide" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {header}
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </div>
  );
}
