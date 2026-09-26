import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/lib/icons';

interface Props {
  title: string;
  subtitle?: string;
  /** Lipsă = dialog obligatoriu (fără „Închide”, Escape sau clic în afară). */
  onClose?: () => void;
  onBack?: () => void;
  width?: number;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Dialog modal: centrat pe desktop, ecran complet pe mobil. Escape închide, focusul intră în dialog. */
export function Dialog({ title, subtitle, onClose, onBack, width = 580, header, footer, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // onClose vine adesea ca funcție inline (nouă la fiecare randare); o ținem într-un ref,
  // ca focusul să fie mutat în dialog o singură dată, la deschidere — altfel câmpurile pierd focusul după fiecare literă.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    // Nu furăm focusul de la un câmp cu autoFocus din dialog.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current?.();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);

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
          {onClose && (
            <button type="button" className="icon-btn" aria-label="Închide" onClick={onClose}>
              <Icon name="x" />
            </button>
          )}
        </div>
        {header}
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </div>
  );
}
