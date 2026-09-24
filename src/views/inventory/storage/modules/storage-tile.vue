<template>
  <ArtTooltip placement="top" :show-after="280" effect="dark">
    <template #content>
      <div class="min-w-56 space-y-1.5 py-1 text-xs leading-5">
        <div class="font-semibold">{{ name }} · {{ code }}</div>
        <div>存放物料 {{ stock.materialCount }} 种</div>
        <div>库存金额 {{ amountText(stock.amount, stock.unpricedCount) }}</div>
        <div>呆滞物料 {{ stock.staleMaterialCount }} 种 · 超过 {{ staleDays }} 天</div>
        <div>呆滞金额 {{ amountText(stock.staleAmount, stock.staleUnpricedCount) }}</div>
      </div>
    </template>
    <button
      type="button"
      class="storage-tile"
      :class="[
        `storage-tile--${tone}`,
        { 'is-selected': selected, 'is-fixed': fixed, 'is-compact': compact }
      ]"
      :aria-label="`${name}，${toneLabel}，点击办理业务，双击查看库存明细`"
      :aria-pressed="selected"
      @click="scheduleSelect"
      @dblclick="openDetail"
    >
      <span class="storage-tile__top">
        <span class="storage-tile__code" :title="code">{{ code }}</span>
        <span class="storage-tile__status">{{ toneLabel }}</span>
      </span>
      <span class="storage-tile__name" :title="name">{{ name }}</span>
      <span class="storage-tile__footer">
        <span>{{ stock.materialCount }} 种物料</span>
        <span v-if="fixed">定容</span>
      </span>
    </button>
  </ArtTooltip>
</template>

<script setup lang="ts">
  import { formatCurrencyValue } from '@/utils/ui/format'
  import ArtTooltip from '@/components/core/feedback/art-tooltip/index.vue'
  import type { StorageStockStat } from '@mdm/api'

  const props = defineProps<{
    code: string
    name: string
    tone: 'available' | 'occupied' | 'abnormal' | 'disabled'
    stock: StorageStockStat
    staleDays: number
    selected?: boolean
    fixed?: boolean
    compact?: boolean
  }>()
  const emit = defineEmits<{ select: []; detail: [] }>()
  let selectTimer: ReturnType<typeof setTimeout> | undefined

  function scheduleSelect(): void {
    if (selectTimer) clearTimeout(selectTimer)
    selectTimer = setTimeout(() => {
      selectTimer = undefined
      emit('select')
    }, 250)
  }

  function openDetail(): void {
    if (selectTimer) clearTimeout(selectTimer)
    selectTimer = undefined
    emit('detail')
  }

  onBeforeUnmount(() => {
    if (selectTimer) clearTimeout(selectTimer)
  })

  const toneLabel = computed(
    () =>
      ({
        available: '可存',
        occupied: '有库存',
        abnormal: '异常',
        disabled: '停用'
      })[props.tone]
  )
  const amountText = (value: number | null, unpricedCount: number): string => {
    const amount = formatCurrencyValue(value ?? 0)
    return unpricedCount ? `${amount} · ${unpricedCount} 批待核价` : amount
  }
</script>

<style scoped lang="scss">
  .storage-tile {
    --tile-color: var(--el-color-success);
    --tile-fill: var(--el-color-success-light-9);

    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    min-width: 0;
    min-height: 124px;
    padding: 14px;
    color: var(--el-text-color-primary);
    text-align: left;
    cursor: pointer;
    background: var(--tile-fill);
    border: 1px solid color-mix(in srgb, var(--tile-color) 36%, transparent);
    border-radius: var(--el-border-radius-base);
    transition:
      border-color 150ms ease,
      transform 150ms ease,
      box-shadow 150ms ease;

    &:hover {
      border-color: var(--tile-color);
      transform: translateY(-2px);
    }

    &:focus-visible {
      outline: 3px solid var(--tile-color);
      outline-offset: 2px;
    }

    &.is-selected {
      box-shadow: inset 0 0 0 2px var(--tile-color);
    }

    &.is-fixed {
      border-style: double;
      border-width: 3px;
    }

    &.is-compact {
      min-height: 108px;
      padding: 10px;

      .storage-tile__code {
        font-size: 12px;
      }
    }

    &--occupied {
      --tile-color: var(--el-color-primary);
      --tile-fill: var(--el-color-primary-light-9);
    }

    &--abnormal {
      --tile-color: var(--el-color-danger);
      --tile-fill: var(--el-color-danger-light-9);
    }

    &--disabled {
      --tile-color: var(--el-color-info);
      --tile-fill: var(--el-fill-color-dark);
    }

    &__top {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
    }

    &__status {
      flex: 0 0 auto;
      padding: 2px 6px;
      font-size: 11px;
      line-height: 16px;
      color: var(--tile-color);
      background: var(--el-bg-color);
      border-radius: var(--el-border-radius-small);
    }

    &__code {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 15px;
      font-weight: 700;
      color: var(--tile-color);
      letter-spacing: 0.02em;
      white-space: nowrap;
    }

    &__name {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
    }

    &__footer {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
