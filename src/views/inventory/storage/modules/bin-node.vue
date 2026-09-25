<template>
  <div class="min-w-0">
    <p
      v-if="depth === 0 && parentCode"
      class="mb-1 truncate text-xs text-[var(--el-text-color-secondary)]"
      :title="`上级库位 ${parentCode}`"
    >
      子单元 · 上级 {{ parentCode }}
    </p>
    <div class="bin-node__tile relative">
      <StorageTile
        :code="bin.binCode"
        :name="bin.binName"
        :tone="toneFor(bin)"
        :stock="stockFor(bin.id)"
        :stale-days="staleDays"
        :fixed="Boolean(bin.fixedMaterialId)"
        :compact="compact || depth > 0"
        with-actions
        @select="emit('select', bin)"
        @detail="emit('detail', bin)"
      />
      <BinActions
        :bin="bin"
        overlay
        @edit="emit('edit', bin)"
        @child="emit('child', bin)"
        @remove="emit('remove', bin)"
      />
    </div>
    <div
      v-if="bin.children?.length"
      class="mt-2 ml-2 space-y-2 border-l-2 border-[var(--el-border-color)] pl-2"
    >
      <p class="text-xs font-medium text-[var(--el-text-color-secondary)]">
        子单元 {{ bin.children.length }}
      </p>
      <BinNode
        v-for="child in bin.children"
        :key="child.id"
        :bin="child"
        :tone-for="toneFor"
        :stock-for="stockFor"
        :stale-days="staleDays"
        :depth="depth + 1"
        compact
        @select="emit('select', $event)"
        @detail="emit('detail', $event)"
        @edit="emit('edit', $event)"
        @child="emit('child', $event)"
        @remove="emit('remove', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { StorageBin, StorageStockStat } from '@mdm/api'
  import StorageTile from './storage-tile.vue'
  import BinActions from './bin-actions.vue'

  defineOptions({ name: 'BinNode' })

  export interface BinBranch extends StorageBin {
    children?: BinBranch[]
  }

  withDefaults(
    defineProps<{
      bin: BinBranch
      toneFor: (bin: StorageBin) => 'available' | 'occupied' | 'abnormal' | 'disabled'
      stockFor: (binId: string) => StorageStockStat
      staleDays: number
      depth?: number
      compact?: boolean
      parentCode?: string
    }>(),
    { depth: 0, compact: false, parentCode: '' }
  )
  const emit = defineEmits<{
    select: [bin: StorageBin]
    detail: [bin: StorageBin]
    edit: [bin: StorageBin]
    child: [bin: StorageBin]
    remove: [bin: StorageBin]
  }>()
</script>

<style scoped lang="scss">
  @media (hover: hover) and (pointer: fine) {
    .bin-node__tile:hover :deep(.storage-card-actions.is-overlay),
    .bin-node__tile:focus-within :deep(.storage-card-actions.is-overlay) {
      pointer-events: auto;
      opacity: 1;
    }
  }
</style>
