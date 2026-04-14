/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_QGIS_WMS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
