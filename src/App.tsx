import { useEffect } from 'react';
import { AppProvider, useApp } from '@/state/AppContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Icon } from '@/lib/icons';
import { TopBar } from '@/components/layout/TopBar';
import { Panel } from '@/components/layout/Panel';
import { MapView } from '@/components/map/MapView';
import { MapControls, MapOverlay } from '@/components/map/MapOverlay';
import { PinCard, ReportDialog } from '@/components/report/ReportDialog';
import { AuthDialog } from '@/components/auth/AuthDialog';

function Shell() {
  const app = useApp();
  const { modal, report, panelOpen, sheetPx, mapInsets, toast } = app;
  const isMobile = useIsMobile();
  const pinMode = modal === 'report' && report.step === 2;

  // Zona hărții acoperită de interfață — folosită la centrarea pe evenimente și la pinul de raportare.
  useEffect(() => {
    if (isMobile) {
      // Înălțimea sheet-ului vine din ResizeObserver (BottomSheet), care actualizează și mapInsets.bottom.
      mapInsets.current = { left: 0, top: 110, bottom: pinMode ? 330 : sheetPx.current };
    } else {
      mapInsets.current = { left: panelOpen && !pinMode ? 432 : 0, top: 64, bottom: pinMode ? 360 : 0 };
    }
  }, [isMobile, pinMode, panelOpen, sheetPx, mapInsets]);

  // Deschide un eveniment din link (?e=id).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('e');
    if (id && app.byId[id]) app.openEvent(id);
  }, [app.loadState]);

  return (
    <div className="app">
      <a className="skip-link" href="#panel">
        Sari la lista evenimentelor
      </a>
      <TopBar />
      <main className={`stage ${pinMode ? 'is-pin' : ''}`} id="panel">
        <MapView />
        <MapOverlay />
        <MapControls />
        <Panel />
        <PinCard />
      </main>
      {modal === 'report' && <ReportDialog />}
      {modal === 'auth' && <AuthDialog />}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className="toast" key={toast}>
            <Icon name="check" size={16} strokeWidth={2.4} />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
