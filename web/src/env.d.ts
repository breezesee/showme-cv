/// <reference types="vite/client" />

/** 构建时由 vite define 注入（见 vite.config.ts 的 define 与 versionManifest） */
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: number

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
