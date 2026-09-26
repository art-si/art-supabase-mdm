<template>
  <section class="min-w-0" :aria-label="`${code}货架`">
    <header class="mb-3 flex items-center gap-2 border-b border-[var(--el-border-color)] pb-2">
      <button
        type="button"
        class="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
        :aria-expanded="expanded"
        @click="emit('toggle')"
      >
        <ArtSvgIcon
          :icon="expanded ? 'ri:arrow-down-s-line' : 'ri:arrow-right-s-line'"
          class="shrink-0 text-[var(--el-text-color-secondary)]"
          aria-hidden="true"
        />
        <strong class="text-sm">{{ code }} 货架</strong>
        <span class="text-xs text-[var(--el-text-color-secondary)]">
          {{ levels.length }} 层 · {{ columnCount }} 列 · {{ binCount }} 个库位
        </span>
      </button>
      <ElButton
        v-if="code !== '未分组'"
        v-auth="'MdmWarehouseBin:Edit'"
        size="small"
        plain
        @click="emit('editShelf')"
      >
        <ArtSvgIcon icon="ri:edit-line" class="mr-1" aria-hidden="true" />
        编辑货架
      </ElButton>
    </header>

    <ElScrollbar v-if="expanded" class="w-full">
      <div class="rack-scroll-content">
        <div class="rack-facade">
          <div v-for="level in levels" :key="level.number" class="rack-level">
            <div class="rack-level__cells" :style="{ '--rack-columns': columnCount }">
              <div
                v-for="(bin, index) in level.bins"
                :key="bin.id"
                class="rack-cell"
                :style="{ gridColumn: String(bin.columnNo || index + 1) }"
              >
                <StorageTile
                  :code="bin.binCode"
                  :name="bin.binName"
                  :tone="toneFor(bin)"
                  :stock="stockFor(bin.id)"
                  :stale-days="staleDays"
                  :fixed="Boolean(bin.fixedMaterialId)"
                  :rack-label="String(bin.columnNo || index + 1)"
                  rack
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
            </div>
            <span class="rack-level__number">{{ level.number }}F</span>
          </div>
        </div>
      </div>
    </ElScrollbar>

    <div
      v-if="expanded && children.length"
      class="mt-3 border-t border-[var(--el-border-color)] pt-3"
    >
      <p class="mb-2 text-xs font-medium text-[var(--el-text-color-secondary)]">
        子单元 {{ children.length }}
      </p>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <BinNode
          v-for="child in children"
          :key="child.id"
          :bin="child"
          :tone-for="toneFor"
          :stock-for="stockFor"
          :stale-days="staleDays"
          :parent-code="parentCodeFor(child)"
          compact
          @select="emit('select', $event)"
          @detail="emit('detail', $event)"
          @edit="emit('edit', $event)"
          @child="emit('child', $event)"
          @remove="emit('remove', $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import type { StorageBin, StorageStockStat } from '@mdm/api'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import StorageTile from '../../storage/modules/storage-tile.vue'
  import BinActions from '../../storage/modules/bin-actions.vue'
  import BinNode from '../../storage/modules/bin-node.vue'

  type RackBin = StorageBin & { children?: RackBin[] }
  type RackLevel = { number: number; bins: RackBin[] }

  const props = defineProps<{
    code: string
    expanded: boolean
    levels: RackLevel[]
    binCount: number
    children: RackBin[]
    toneFor: (bin: StorageBin) => 'available' | 'occupied' | 'abnormal' | 'disabled'
    stockFor: (binId: string) => StorageStockStat
    staleDays: number
    parentCodeFor: (bin: StorageBin) => string | undefined
  }>()
  const emit = defineEmits<{
    select: [bin: StorageBin]
    detail: [bin: StorageBin]
    edit: [bin: StorageBin]
    child: [bin: StorageBin]
    remove: [bin: StorageBin]
    toggle: []
    editShelf: []
  }>()

  const columnCount = computed(() =>
    Math.max(1, ...props.levels.flatMap((level) => level.bins.map((bin) => bin.columnNo ?? 0)))
  )
</script>

<style scoped lang="scss">
  .rack-scroll-content {
    display: inline-block;
    min-width: 100%;
    padding: 18px 24px 20px 2px;
  }

  .rack-facade {
    --rack-metal: color-mix(in srgb, var(--el-text-color-secondary) 44%, var(--el-fill-color));
    --rack-highlight: color-mix(in srgb, var(--el-bg-color) 68%, var(--rack-metal));
    --rack-shadow: color-mix(in srgb, var(--el-text-color-primary) 18%, transparent);

    position: relative;
    display: inline-flex;
    flex-direction: column;
    min-width: max-content;
    padding: 8px 10px 0;
    background: color-mix(in srgb, var(--el-text-color-secondary) 6%, var(--el-fill-color));
    border: solid var(--rack-metal);
    border-width: 12px 8px 10px;
    border-radius: 3px;
    box-shadow:
      inset 0 0 0 1px var(--el-border-color-dark),
      inset 5px 0 9px var(--rack-shadow),
      3px 5px 0 color-mix(in srgb, var(--rack-metal) 54%, transparent);

    &::before {
      position: absolute;
      top: -21px;
      right: -6px;
      left: 1px;
      height: 8px;
      content: '';
      background: linear-gradient(180deg, var(--rack-highlight), var(--rack-metal));
      border: 1px solid var(--el-border-color-dark);
      transform: skewX(-42deg);
      transform-origin: bottom left;
    }

    &::after {
      position: absolute;
      top: -13px;
      right: -19px;
      bottom: -6px;
      width: 10px;
      content: '';
      background: linear-gradient(90deg, var(--rack-metal), var(--el-border-color-dark));
      border: 1px solid var(--el-border-color-dark);
      transform: skewY(-43deg);
      transform-origin: top left;
    }
  }

  .rack-level {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 7px 0 9px;
    border-bottom: 7px solid var(--rack-metal);
    box-shadow: 0 3px 3px -2px var(--rack-shadow);

    &:last-child {
      border-bottom-width: 10px;
    }

    &__cells {
      display: grid;
      grid-template-columns: repeat(var(--rack-columns), 114px);
      gap: 8px;
    }

    &__number {
      width: 30px;
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-secondary);
      text-align: right;
      white-space: nowrap;
    }
  }

  .rack-cell {
    position: relative;
    min-width: 0;
  }

  @media (hover: hover) and (pointer: fine) {
    .rack-cell:hover :deep(.storage-card-actions.is-overlay),
    .rack-cell:focus-within :deep(.storage-card-actions.is-overlay) {
      pointer-events: auto;
      opacity: 1;
    }
  }
</style>
