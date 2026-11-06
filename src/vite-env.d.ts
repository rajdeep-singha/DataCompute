/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARKIV_ACCESS_KEY?: string
  readonly VITE_VERIFIER_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
