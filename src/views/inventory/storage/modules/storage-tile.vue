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
        {
          'is-selected': selected,
          'is-fixed': fixed,
          'is-compact': compact,
          'is-rack': rack,
          'has-detail': Boolean(detail),
          'has-actions': withActions
        }
      ]"
      :aria-label="`${name}，${toneLabel}，点击办理业务，双击查看库存明细`"
      :aria-pressed="selected"
      @click="scheduleSelect"
      @dblclick="openDetail"
    >
      <template v-if="rack">
        <span class="storage-tile__rack-label"
          ><strong>{{ rackLabel }}</strong
          ><small>列</small></span
        >
        <span class="storage-tile__rack-status">{{ toneLabel }}</span>
        <span class="storage-tile__rack-count">{{ stock.materialCount }} 种物料</span>
      </template>
      <template v-else>
        <span class="storage-tile__top">
          <span class="storage-tile__code" :title="code">{{ code }}</span>
        </span>
        <span class="storage-tile__name" :title="name">{{ name }}</span>
        <span v-if="detail" class="storage-tile__detail" :title="detail">{{ detail }}</span>
        <span class="storage-tile__footer">
          <span class="storage-tile__status">{{ toneLabel }}</span>
          <span>{{ stock.materialCount }} 种物料</span>
          <span v-if="fixed">定容</span>
        </span>
      </template>
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
    detail?: string
    tone: 'available' | 'occupied' | 'abnormal' | 'disabled'
    stock: StorageStockStat
    staleDays: number
    selected?: boolean
    fixed?: boolean
    compact?: boolean
    rack?: boolean
    rackLabel?: string
    withActions?: boolean
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
      box-shadow 150ms ease;

    &:hover {
      border-color: var(--tile-color);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--tile-color) 14%, transparent);
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

    &.has-detail {
      min-height: 140px;
    }

    &.is-rack {
      gap: 1px;
      align-items: flex-start;
      justify-content: center;
      min-height: 84px;
      padding: 10px 9px 8px;
      text-align: left;
      background: color-mix(in srgb, var(--tile-color) 25%, var(--el-bg-color));
      border-color: color-mix(in srgb, var(--tile-color) 70%, var(--el-border-color));
      border-radius: 4px;
      box-shadow: inset 0 2px 0 color-mix(in srgb, var(--el-bg-color) 62%, transparent);

      &:hover {
        background: color-mix(in srgb, var(--tile-color) 32%, var(--el-bg-color));
      }

      .storage-tile__rack-label {
        display: flex;
        gap: 3px;
        align-items: baseline;
        font-variant-numeric: tabular-nums;
        line-height: 25px;
        color: color-mix(in srgb, var(--tile-color) 70%, var(--el-text-color-primary));

        strong {
          font-size: 20px;
          font-weight: 750;
        }

        small {
          font-size: 11px;
          font-weight: 600;
        }
      }

      .storage-tile__rack-status {
        display: flex;
        gap: 5px;
        align-items: center;
        font-size: 11px;
        font-weight: 700;
        line-height: 16px;

        &::before {
          width: 5px;
          height: 5px;
          content: '';
          background: var(--tile-color);
          border-radius: 50%;
        }
      }

      .storage-tile__rack-count {
        margin-top: 3px;
        font-size: 10px;
        line-height: 14px;
        color: var(--el-text-color-secondary);
      }

      &.is-fixed {
        border-width: 2px;
      }
    }

    &.has-actions:not(.is-rack) .storage-tile__top {
      padding-right: 30px;
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
      align-items: flex-start;
      justify-content: space-between;
      min-width: 0;
    }

    &__status {
      flex: 0 0 auto;
      padding: 1px 6px;
      font-size: 11px;
      line-height: 16px;
      color: var(--tile-color);
      background: var(--el-bg-color);
      border-radius: var(--el-border-radius-small);
    }

    &__code {
      display: -webkit-box;
      min-width: 0;
      overflow: hidden;
      -webkit-line-clamp: 2;
      font-size: 15px;
      font-weight: 700;
      color: var(--tile-color);
      letter-spacing: 0.02em;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
    }

    &__name {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 2;
      font-size: 13px;
      font-weight: 600;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
    }

    &__detail {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    &__footer {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: auto;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }
</style>
