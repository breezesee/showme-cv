<script lang="ts">
/** 线性图标（24×24，描边风格，与 SF Symbols 观感接近） */
export type IconName =
  | 'edit' | 'eye' | 'share' | 'print' | 'download' | 'upload' | 'up' | 'down'
  | 'trash' | 'plus' | 'copy' | 'chevron' | 'close' | 'send' | 'check' | 'qr' | 'expand'
  | 'save' | 'user'
</script>

<script setup lang="ts">
defineProps<{ name: IconName }>()

const paths: Record<IconName, string> = {
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  share: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v12H9zM5 15V3h10',
  chevron: 'M9 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z',
  check: 'M5 12l5 5 9-10',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 20h2M18 18h2v2',
  expand: 'M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5',
  save: 'M5 4h11l3 3v13H5zM8 4v6h8V4M8 20v-6h8v6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
