import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Icon } from '@/lib/icons';
import { SHEET_SNAPS, useApp, type SheetSnap } from '@/state/AppContext';
import { t } from '@/i18n';

export interface SheetHeader {
  title: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  contextLabel?: string;
}

interface Props {
  /** aria-label pentru secțiune. */
  label: string;
  header: SheetHeader;
  /** Rândul al doilea din bara mini (implicit: subtitlul). */
  miniLine?: ReactNode;
  /** Textul citit de cititorul de ecran pentru bara mini (fără acțiune). */
  miniAria?: string;
  /** Punctul din bara mini: normal, încărcare (puls), eroare, offline. */
  live?: 'ok' | 'loading' | 'error' | 'offline';
  /** Cheia paginii: la schimbare, derularea și linia de separare se resetează. */
  pageKey: string;
  children: ReactNode;
  /** Subsol fix, afișat doar în starea 'tall'. */
  footer?: ReactNode;
  centerBody?: boolean;
  padBody?: boolean;
}

const MINI_H = 92;
const TAP_SLOP = 6;
const FLING_V = 0.5; // px/ms

interface Drag {
  y0: number;
  h0: number;
  moved: boolean;
  lastY: number;
  lastT: number;
  v: number;
  toggle: boolean;
}

/** Bottom sheet mobil cu 3 stări: mini (bară), mid (jumătate), tall (aproape tot ecranul). */
export function BottomSheet({ label, header, miniLine, miniAria, live = 'ok', pageKey, children, footer, centerBody, padBody }: Props) {
  const { sheetSnap: snap, setSheetSnap, cycleSheet, sheetPx, mapInsets, modal } = useApp();
  const ref = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const bodyId = useId();

  const snapHeights = (): Record<SheetSnap, number> => {
    const parent = ref.current?.offsetParent as HTMLElement | null;
    const H = parent?.clientHeight ?? window.innerHeight;
    return { mini: MINI_H, mid: Math.round(H * 0.46), tall: H - 8 };
  };

  // Înălțimea reală → controalele hărții, toast-ul și centrarea hărții (mapInsets).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const apply = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      const H = (el.offsetParent as HTMLElement | null)?.clientHeight ?? window.innerHeight;
      sheetPx.current = h;
      mapInsets.current.bottom = h;
      root.style.setProperty('--sheet-px', `${h}px`);
      root.style.setProperty('--toast-b', `${h > H * 0.6 ? 96 : h + 20}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--sheet-px');
      root.style.removeProperty('--toast-b');
    };
  }, [sheetPx, mapInsets]);

  // În 'mini', corpul nu primește focus.
  useEffect(() => {
    bodyRef.current?.toggleAttribute('inert', snap === 'mini');
  }, [snap]);

  // Pagină nouă: derularea de la început, fără linie de separare.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setScrolled(false);
  }, [pageKey]);

  // Escape în 'tall' → 'mid' (doar când nu e deschis un dialog).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && snap === 'tall' && !modal) setSheetSnap('mid');
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [snap, modal, setSheetSnap]);

  // ---------- tragere (Pointer Events) ----------
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    const btn = (e.target as HTMLElement).closest('button');
    if (btn && !btn.hasAttribute('data-sheet-toggle')) return; // butoanele din antet (Înapoi, Restrânge) își păstrează click-ul
    drag.current = { y0: e.clientY, h0: ref.current.getBoundingClientRect().height, moved: false, lastY: e.clientY, lastT: performance.now(), v: 0, toggle: !!btn };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dy = d.y0 - e.clientY;
    if (!d.moved && Math.abs(dy) < TAP_SLOP) return;
    d.moved = true;
    el.classList.add('is-dragging');
    const { mini, tall } = snapHeights();
    el.style.height = `${Math.max(mini, Math.min(tall, d.h0 + dy))}px`;
    const now = performance.now();
    d.v = (d.lastY - e.clientY) / Math.max(1, now - d.lastT); // pozitiv = în sus
    d.lastY = e.clientY;
    d.lastT = now;
  };
  const endDrag = (cancel: boolean) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    if (!d.moved) {
      if (!cancel && d.toggle) cycleSheet();
      return;
    }
    const h = el.getBoundingClientRect().height;
    el.classList.remove('is-dragging');
    el.style.removeProperty('height');
    const hs = snapHeights();
    const order = SHEET_SNAPS.map((s) => [s, hs[s]] as const).sort((a, b) => a[1] - b[1]);
    let target: SheetSnap;
    if (Math.abs(d.v) > FLING_V) {
      target = d.v > 0
        ? (order.find(([, v]) => v > h + 4) ?? order[order.length - 1])[0]
        : ([...order].reverse().find(([, v]) => v < h - 4) ?? order[0])[0];
    } else {
      target = SHEET_SNAPS.reduce((best, s) => (Math.abs(hs[s] - h) < Math.abs(hs[best] - h) ? s : best), 'mini' as SheetSnap);
    }
    setSheetSnap(target);
  };
  // Atingerea e tratată în pointerup; un click cu detail 0 vine de la tastatură (Enter / Space).
  const keyToggle = (e: ReactMouseEvent) => {
    if (e.detail === 0) cycleSheet();
  };

  const baseAria = miniAria ?? header.title;
  const gripLabel = snap === 'mini' ? `${baseAria}. ${t('Extinde lista la jumătate')}` : snap === 'mid' ? t('Extinde lista pe tot ecranul') : t('Restrânge lista');

  return (
    <section ref={ref} className="sheet" data-snap={snap} aria-label={label}>
      <div className="sheet__top" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => endDrag(false)} onPointerCancel={() => endDrag(true)}>
        <button
          type="button"
          className="sheet__grip"
          data-sheet-toggle
          aria-label={gripLabel}
          aria-expanded={snap !== 'mini'}
          aria-controls={bodyId}
          tabIndex={snap === 'mini' ? -1 : 0}
          aria-hidden={snap === 'mini' || undefined}
          onClick={keyToggle}
        >
          <span />
        </button>

        {snap === 'mini' ? (
          <button
            type="button"
            className="sheet__mini"
            data-sheet-toggle
            aria-expanded={false}
            aria-controls={bodyId}
            aria-label={`${baseAria}. ${t('Extinde lista la jumătate')}`}
            onClick={keyToggle}
          >
            <span className="sheet__titles">
              <span className="sheet__title">{header.title}</span>
              <span className="sheet__count">
                <span className={`live live--${live}`} aria-hidden="true" />
                <span className="sheet__count-text">{miniLine ?? header.subtitle}</span>
              </span>
            </span>
            <span className="sheet__chev" aria-hidden="true">
              <Icon name="chevU" size={18} strokeWidth={2.2} />
            </span>
          </button>
        ) : (
          <div className={`sheet__head ${header.onBack ? 'has-back' : ''} ${scrolled ? 'is-scrolled' : ''}`}>
            {header.onBack && (
              <button type="button" className="icon-btn" aria-label={header.backLabel ?? 'Înapoi'} onClick={header.onBack}>
                <Icon name="chevL" size={20} />
              </button>
            )}
            <div className="sheet__titles">
              <h2 className="sheet__title">{header.title}</h2>
              {header.subtitle && <p className="sheet__sub">{header.subtitle}</p>}
            </div>
            {header.contextLabel && <span className="sheet__tag">{header.contextLabel}</span>}
            <button type="button" className="sheet__collapse" aria-label={t('Restrânge')} onClick={() => setSheetSnap(snap === 'tall' ? 'mid' : 'mini')}>
              <Icon name="chevD" size={18} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={bodyRef}
        id={bodyId}
        className={`sheet__body ${padBody ? 'sheet__body--pad' : ''} ${centerBody ? 'sheet__body--center' : ''}`}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
      >
        {children}
      </div>

      {footer && snap === 'tall' && <div className="sheet__foot">{footer}</div>}
    </section>
  );
}
