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
import { LocationDialog } from '@/components/location/LocationDialog';
import { Splash } from '@/components/layout/Splash';
import { ProximityPrompt } from '@/components/events/ProximityPrompt';
import { ONBOARDED_KEY, ONBOARDING_VERSION, Onboarding } from '@/components/help/Onboarding';
import { ConsentBanner } from '@/components/legal/ConsentBanner';
import { LegalDialog } from '@/components/legal/LegalDialog';
import { load, save } from '@/lib/storage';
import { t } from '@/i18n';
import { TelegramLinkPage } from '@/components/auth/TelegramLinkPage';

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

  // Prima vizită: ghidul „cum funcționează” (o singură dată pe versiune; se redeschide din Setări).
  useEffect(() => {
    // Întâi alegerea privind cookie-urile (bannerul de la prima deschidere), apoi ghidul.
    if (app.loadState !== 'ready' || modal || app.consentOpen || load<number | boolean>(ONBOARDED_KEY, false) === ONBOARDING_VERSION) return;
    save(ONBOARDED_KEY, ONBOARDING_VERSION);
    app.setModal('help');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.loadState, app.consentOpen]);

  // Deschide un eveniment din link (?e=id).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('e');
    if (id && app.byId[id]) app.openEvent(id);
  }, [app.loadState]);

  return (
    <div className="app">
      <a className="skip-link" href="#panel">
        {t('Sari la lista evenimentelor')}
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
      {modal === 'location' && <LocationDialog />}
      {modal === 'help' && <Onboarding />}
      <ProximityPrompt />
      <ConsentBanner />
      <LegalDialog />
      <Splash />
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
  if (window.location.pathname.replace(/\/$/, '') === '/telegram-auth') {
    return <TelegramLinkPage />;
  }

  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
