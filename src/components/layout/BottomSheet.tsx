import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
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

/** Curba mișcării la eliberare / la schimbarea poziției (ușor „elastică” la final, ca foile native). */
const SNAP_MS = 340;
const SNAP_EASE = 'cubic-bezier(0.22, 0.9, 0.24, 1)';

interface Drag {
  y0: number;
  h0: number;
  /** Înălțimea completă a foii în timpul tragerii (se mută doar cu transform, fără relayout). */
  full: number;
  /** Înălțimea vizibilă curentă. */
  h: number;
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
  /** În timpul tragerii / animației, observatorul de mărime nu scrie variabile CSS (ar face relayout la fiecare cadru). */
  const busy = useRef(false);
  /** Înălțimea în repaus (ultima poziție stabilă), punctul de plecare al animației la schimbarea poziției. */
  const restH = useRef<number | null>(null);
  /** Recalculează --sheet-px / mapInsets (setat de efectul de mai jos). */
  const writeNow = useRef<() => void>(() => {});
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
    // Cel mult o actualizare pe cadru și doar când înălțimea chiar s-a schimbat: variabilele CSS de pe <html>
    // recalculează stilurile întregii pagini, iar la tragerea foii observatorul se declanșează la fiecare pixel.
    let frame = 0;
    let last = -1;
    const write = () => {
      frame = 0;
      if (busy.current) return;
      const h = Math.round(el.getBoundingClientRect().height);
      restH.current = h;
      if (h === last) return;
      last = h;
      const H = (el.offsetParent as HTMLElement | null)?.clientHeight ?? window.innerHeight;
      sheetPx.current = h;
      mapInsets.current.bottom = h;
      root.style.setProperty('--sheet-px', `${h}px`);
      root.style.setProperty('--toast-b', `${h > H * 0.6 ? 96 : h + 20}px`);
    };
    const apply = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };
    writeNow.current = () => {
      last = -1;
      write();
    };
    write();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      root.style.removeProperty('--sheet-px');
      root.style.removeProperty('--toast-b');
    };
  }, [sheetPx, mapInsets]);

  /** Butoanele hărții (Locația mea, Raportează) urmăresc foaia doar prin transform, fără relayout. */
  const moveFloating = (visibleH: number | null) => {
    const base = restH.current ?? visibleH ?? 0;
    document.querySelectorAll<HTMLElement>('.controls').forEach((c) => {
      c.style.transform = visibleH == null ? '' : `translate3d(0, ${base - visibleH}px, 0)`;
    });
  };

  /**
   * Mișcă foaia de la înălțimea vizibilă `from` la `to` doar prin transform: foaia are pe durata mișcării
   * înălțimea cea mai mare dintre cele două, iar partea în plus stă sub marginea ecranului. La final, `done`
   * fixează poziția (clasa data-snap) și totul revine la stilurile normale — un singur relayout.
   */
  const glide = (from: number, to: number, done?: () => void) => {
    const el = ref.current;
    if (!el) return;
    busy.current = true;
    const full = Math.max(from, to);
    el.style.transition = 'none';
    el.style.height = `${full}px`;
    el.style.transform = `translate3d(0, ${full - from}px, 0)`;
    el.classList.add('is-moving');
    void el.offsetHeight; // aplică poziția de start înainte de tranziție
    el.style.transition = `transform ${SNAP_MS}ms ${SNAP_EASE}`;
    el.style.transform = `translate3d(0, ${full - to}px, 0)`;
    document.querySelectorAll<HTMLElement>('.controls').forEach((c) => {
      c.style.transition = `transform ${SNAP_MS}ms ${SNAP_EASE}`;
    });
    moveFloating(to);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.removeEventListener('transitionend', onEnd);
      done?.();
      el.style.transition = '';
      el.style.height = '';
      el.style.transform = '';
      el.classList.remove('is-moving');
      document.querySelectorAll<HTMLElement>('.controls').forEach((c) => {
        c.style.transition = '';
        c.style.transform = '';
      });
      busy.current = false;
      // --sheet-px / mapInsets pentru poziția nouă (observatorul nu se declanșează dacă înălțimea finală e aceeași).
      writeNow.current();
    };
    const onEnd = (e: TransitionEvent) => e.target === el && e.propertyName === 'transform' && finish();
    el.addEventListener('transitionend', onEnd);
    window.setTimeout(finish, SNAP_MS + 80); // rezervă, dacă transitionend nu vine
  };

  // Schimbarea poziției din butoane (săgeată, „Restrânge”, deschiderea unui eveniment): aceeași mișcare lină.
  const lastSnap = useRef(snap);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || lastSnap.current === snap) return;
    lastSnap.current = snap;
    const from = restH.current;
    if (busy.current || from == null) return; // tragerea își face singură animația
    const to = el.getBoundingClientRect().height; // noua clasă data-snap e deja aplicată
    if (Math.abs(to - from) > 2) glide(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);

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

  // ---------- tragere (Pointer Events): doar transform, fără relayout la fiecare cadru ----------
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current || busy.current) return;
    const btn = (e.target as HTMLElement).closest('button');
    if (btn && !btn.hasAttribute('data-sheet-toggle')) return; // butoanele din antet (Înapoi, Restrânge) își păstrează click-ul
    const h0 = ref.current.getBoundingClientRect().height;
    drag.current = { y0: e.clientY, h0, full: snapHeights().tall, h: h0, moved: false, lastY: e.clientY, lastT: performance.now(), v: 0, toggle: !!btn };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dy = d.y0 - e.clientY;
    if (!d.moved) {
      if (Math.abs(dy) < TAP_SLOP) return;
      // Începutul tragerii: foaia primește o singură dată înălțimea maximă; de aici se mută doar cu transform.
      d.moved = true;
      busy.current = true;
      restH.current = d.h0;
      el.classList.add('is-dragging');
      el.style.transition = 'none';
      el.style.height = `${d.full}px`;
    }
    const { mini, tall } = snapHeights();
    // Peste capete: rezistență (ca pe iOS), nu oprire bruscă.
    const raw = d.h0 + dy;
    d.h = raw > tall ? tall + (raw - tall) * 0.2 : raw < mini ? mini - (mini - raw) * 0.2 : raw;
    el.style.transform = `translate3d(0, ${d.full - d.h}px, 0)`;
    moveFloating(Math.min(d.h, tall));
    const now = performance.now();
    const v = (d.lastY - e.clientY) / Math.max(1, now - d.lastT); // pozitiv = în sus
    d.v = d.v * 0.6 + v * 0.4; // netezit, ca un tremur de deget să nu decidă direcția
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
    el.classList.remove('is-dragging');
    const hs = snapHeights();
    const h = Math.max(hs.mini, Math.min(hs.tall, d.h));
    const order = SHEET_SNAPS.map((s) => [s, hs[s]] as const).sort((a, b) => a[1] - b[1]);
    let target: SheetSnap;
    if (Math.abs(d.v) > FLING_V) {
      target = d.v > 0
        ? (order.find(([, v]) => v > h + 4) ?? order[order.length - 1])[0]
        : ([...order].reverse().find(([, v]) => v < h - 4) ?? order[0])[0];
    } else {
      target = SHEET_SNAPS.reduce((best, s) => (Math.abs(hs[s] - h) < Math.abs(hs[best] - h) ? s : best), 'mini' as SheetSnap);
    }
    // Se continuă din poziția degetului; la final se fixează clasa (fără o a doua animație).
    el.style.height = '';
    el.style.transform = '';
    glide(h, hs[target], () => {
      lastSnap.current = target;
      flushSync(() => setSheetSnap(target));
    });
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
