/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_DEMO_LOCATION?: string;
  readonly VITE_TILES_LIGHT?: string;
  readonly VITE_TILES_DARK?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
