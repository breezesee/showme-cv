/// <reference types="vite/client" />

/** 构建时由 vite define 注入（见 vite.config.ts 的 define 与 versionManifest） */
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: number

/** vite 虚拟模块：构建期打包的三套自包含模板（见 vite.config.ts 的 templateModule） */
declare module 'virtual:showme-templates' {
  export const TEMPLATES: Record<string, string>
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
