<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from './adminFormat'
import type { DailyPoint } from './adminTypes'

const props = defineProps<{
  title: string
  points: DailyPoint[]
  unit: string
  tone: 'blue' | 'gold'
}>()

const total = computed(() => props.points.reduce((sum, p) => sum + p.count, 0))
const peak = computed(() => props.points.reduce((max, p) => Math.max(max, p.count), 0))
const max = computed(() => Math.max(1, peak.value))
const lastIndex = computed(() => props.points.length - 1)
const summary = computed(() => props.points.map((p) => `${p.date} ${p.count}`).join('，'))

function barHeight(count: number): string {
  return `${Math.max(8, Math.round((count / max.value) * 100))}%`
}
</script>

<template>
  <section class="adm-card adm-chart" :class="`tone-${tone}`">
    <header class="adm-card-head">
      <div>
        <h3>{{ title }}</h3>
        <p class="adm-card-note">近 14 天 · 共 {{ formatNumber(total) }} {{ unit }}</p>
      </div>
      <span class="adm-chart-peak">峰值 {{ peak }}</span>
    </header>

    <template v-if="points.length">
      <div class="adm-bars" role="img" :aria-label="`${title}近 14 天：${summary}`">
        <div
          v-for="(p, i) in points"
          :key="p.date"
          class="adm-bar-slot"
          :title="`${p.date}：${p.count} ${unit}`"
        >
          <span
            class="adm-bar"
            :class="{ zero: p.count === 0, today: i === lastIndex }"
            :style="{ height: p.count === 0 ? undefined : barHeight(p.count) }"
          />
        </div>
      </div>
      <div class="adm-bar-axis">
        <span>{{ points[0]?.date }}</span>
        <span>{{ points[lastIndex]?.date }}</span>
      </div>
    </template>
    <p v-else class="adm-empty">暂无数据</p>
  </section>
</template>
