<template>
  <ArtPermissionGuard permission="MdmWarehouseBin3d:View" resource-name="立体库位">
    <div class="business-workspace-page art-full-height gap-4">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="立体库位"
        description="沿仓库与库区定位货架，从空间视图快速识别层位和库存状态。"
        icon="ri:building-2-line"
      />

      <div
        class="overview-strip art-card-xs flex flex-wrap items-center gap-x-7 gap-y-3 px-5 py-3.5"
      >
        <div class="min-w-0 flex-1">
          <span class="block text-xs text-[var(--el-text-color-secondary)]">当前库区</span>
          <strong
            class="block truncate text-sm"
            :title="selectedZone?.zoneName || selectedWarehouse?.warehouseName"
          >
            {{ selectedZone?.zoneName || selectedWarehouse?.warehouseName || '请选择库区' }}
          </strong>
        </div>
        <div class="overview-metric"
          ><strong>{{ racks.length }}</strong
          ><span>组货架</span></div
        >
        <div class="overview-metric"
          ><strong>{{ zoneBins.length }}</strong
          ><span>个层位</span></div
        >
        <div class="overview-metric is-occupied"
          ><strong>{{ occupiedCount }}</strong
          ><span>有货</span></div
        >
        <div class="overview-metric"
          ><strong>{{ emptyCount }}</strong
          ><span>空位</span></div
        >
      </div>

      <ArtWorkspaceSplitter
        primary-size="228px"
        primary-min="195px"
        primary-max="310px"
        :breakpoint="1120"
        stacked-primary-size="210px"
      >
        <template #primary>
          <ArtSectionCard
            :show-scrollbar="false"
            title="货架库区"
            :subtitle="selectedWarehouse?.enableZones ? `${zones.length} 个库区` : '仓库直挂库位'"
            root-class="flex min-h-0 flex-col"
            body-class="min-h-0 flex-1"
            :loading="loadingWarehouses"
            :error="warehouseError"
            :empty="!loadingWarehouses && !warehouseError && !warehouses.length"
            empty-title="暂无仓库"
            @retry="loadWarehouses"
          >
            <ElScrollbar height="100%">
              <nav class="space-y-3 pr-1" aria-label="货架库区导航">
                <div v-for="warehouse in warehouses" :key="warehouse.id" class="space-y-1">
                  <button
                    type="button"
                    class="nav-warehouse flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
                    :class="{ 'is-current': selectedWarehouseId === warehouse.id }"
                    :aria-expanded="selectedWarehouseId === warehouse.id"
                    @click="selectWarehouse(warehouse.id)"
                  >
                    <ArtSvgIcon icon="ri:store-2-line" class="shrink-0" aria-hidden="true" />
                    <span
                      class="min-w-0 flex-1 truncate text-sm font-semibold"
                      :title="warehouse.warehouseName"
                      >{{ warehouse.warehouseName }}</span
                    >
                    <ArtSvgIcon
                      :icon="
                        selectedWarehouseId === warehouse.id
                          ? 'ri:arrow-down-s-line'
                          : 'ri:arrow-right-s-line'
                      "
                      class="shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    v-if="selectedWarehouseId === warehouse.id"
                    class="space-y-1 border-l border-[var(--el-border-color)] pl-3"
                  >
                    <div
                      v-if="!warehouse.enableZones"
                      class="nav-zone is-current flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                      aria-current="page"
                    >
                      仓库直挂<span class="text-xs tabular-nums">{{ zoneShelfCount(null) }}</span>
                    </div>
                    <button
                      v-for="zone in zones"
                      :key="zone.id"
                      type="button"
                      class="nav-zone flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
                      :class="{ 'is-current': selectedZoneId === zone.id }"
                      :aria-current="selectedZoneId === zone.id ? 'page' : undefined"
                      @click="selectZone(zone.id)"
                    >
                      <span class="min-w-0 truncate" :title="zone.zoneName">{{
                        zone.zoneName
                      }}</span>
                      <span class="shrink-0 text-xs tabular-nums">{{
                        zoneShelfCount(zone.id)
                      }}</span>
                    </button>
                    <p
                      v-if="warehouse.enableZones && !loadingBins && !zones.length"
                      class="px-3 py-5 text-xs text-[var(--el-text-color-secondary)]"
                    >
                      暂无库区，请先在“库区”菜单中维护。
                    </p>
                  </div>
                </div>
              </nav>
            </ElScrollbar>
          </ArtSectionCard>
        </template>

        <ArtWorkspaceSplitter
          class="three-d-workspace"
          primary-size="72%"
          primary-min="480px"
          primary-max="100%"
          :primary-collapsible="false"
          secondary-min="235px"
          :breakpoint="1120"
          stacked-primary-size="580px"
          stacked-secondary-min-size="320px"
        >
          <template #primary>
            <ArtSectionCard
              title="库位空间"
              :subtitle="
                selectedZone
                  ? `${selectedWarehouse?.warehouseName} · ${selectedZone.zoneName}`
                  : selectedWarehouse?.warehouseName || '选择左侧库区'
              "
              root-class="flex min-h-0 min-w-0 flex-col"
              body-class="flex min-h-0 min-w-0 flex-1 flex-col"
              :loading="loadingBins"
              :error="binError"
              @retry="loadBins"
            >
              <template #actions>
                <div class="scene-actions flex flex-wrap items-center gap-2">
                  <div class="view-switch" aria-label="视角切换">
                    <button
                      type="button"
                      :aria-pressed="viewMode === 'spatial'"
                      :class="{ 'is-current': viewMode === 'spatial' }"
                      @click="setViewMode('spatial')"
                      >立体</button
                    >
                    <button
                      type="button"
                      :aria-pressed="viewMode === 'top'"
                      :class="{ 'is-current': viewMode === 'top' }"
                      @click="setViewMode('top')"
                      >俯视</button
                    >
                  </div>
                  <ElPopover
                    v-model:visible="spacingOpen"
                    trigger="click"
                    placement="bottom-end"
                    :width="276"
                  >
                    <div class="space-y-4 p-1">
                      <p class="text-sm font-semibold">空间间距</p>
                      <label class="flex items-center gap-3 text-xs">
                        <span class="w-8 shrink-0">列距</span>
                        <ElSlider
                          v-model="spacing.column"
                          class="min-w-0 flex-1"
                          :min="8"
                          :max="48"
                          :step="4"
                          :show-tooltip="false"
                          aria-label="列间距"
                        />
                        <span class="w-9 text-right tabular-nums">{{ spacing.column }}px</span>
                      </label>
                      <label class="flex items-center gap-3 text-xs">
                        <span class="w-8 shrink-0">层距</span>
                        <ElSlider
                          v-model="spacing.level"
                          class="min-w-0 flex-1"
                          :min="2"
                          :max="24"
                          :step="2"
                          :show-tooltip="false"
                          aria-label="层间距"
                        />
                        <span class="w-9 text-right tabular-nums">{{ spacing.level }}px</span>
                      </label>
                      <p class="text-xs text-[var(--el-text-color-secondary)]"
                        >间距仅影响当前浏览器的显示，自动保存。</p
                      >
                    </div>
                    <template #reference>
                      <ArtIconButton
                        icon="ri:equalizer-2-line"
                        label="间距设置"
                        class="scene-icon-button"
                      />
                    </template>
                  </ElPopover>
                  <ArtIconButton
                    icon="ri:focus-3-line"
                    label="重置视角"
                    class="scene-icon-button"
                    @click="sceneRef?.resetView()"
                  />
                  <ArtIconButton
                    icon="ri:refresh-line"
                    label="刷新库位"
                    class="scene-icon-button"
                    :loading="loadingBins"
                    @click="loadBins"
                  />
                </div>
              </template>

              <ArtEmptyState
                v-if="
                  !selectedWarehouse?.enableLocations ||
                  (!loadingBins && !binError && !racks.length)
                "
                class="min-h-0 flex-1"
                :title="selectedWarehouse?.enableLocations ? '当前库区暂无货架' : '尚未启用库位'"
                :description="
                  selectedWarehouse?.enableLocations
                    ? '可在“库位”菜单中生成货架后返回查看。'
                    : '请先在仓库定义中启用库位。'
                "
                size="compact"
                :visual-size="80"
              />
              <div v-else class="scene-frame relative min-h-0 flex-1">
                <RackScene
                  ref="sceneRef"
                  :racks="racks"
                  :selected-rack-code="selectedRack?.code || ''"
                  :selected-bin-id="selectedBinId"
                  :column-gap="spacing.column"
                  :level-gap="spacing.level"
                  :view-mode="viewMode"
                  :tone-for="binTone"
                  @select-bin="selectBin"
                  @select-rack="selectRack"
                />
                <div class="scene-context" aria-hidden="true">
                  <span class="text-[10px] font-semibold tracking-widest">WAREHOUSE SPACE</span>
                  <strong>{{ selectedZone?.zoneName || '仓库直挂' }}</strong>
                  <small>{{ racks.length }} 组货架 · {{ zoneBins.length }} 个层位</small>
                </div>
                <div class="scene-legend" aria-label="货架状态图例">
                  <span><i class="legend-dot is-empty"></i>空位</span>
                  <span><i class="legend-dot is-occupied"></i>有货</span>
                  <span><i class="legend-dot is-abnormal"></i>异常</span>
                  <span><i class="legend-dot is-disabled"></i>停用</span>
                </div>
              </div>
            </ArtSectionCard>
          </template>

          <template #default>
            <ArtSectionCard
              :show-scrollbar="false"
              title="货架详情"
              :subtitle="selectedRack ? `${selectedRack.code} 货架` : '选择货架或层位'"
              root-class="flex min-h-0 flex-col"
              body-class="min-h-0 flex-1"
            >
              <ElScrollbar height="100%">
                <div v-if="selectedRack" class="space-y-5 pr-1">
                  <div class="detail-identity">
                    <span class="text-xs text-[var(--el-text-color-secondary)]">当前货架</span>
                    <strong class="block truncate text-xl" :title="selectedRack.code">{{
                      selectedRack.code
                    }}</strong>
                    <span class="text-xs text-[var(--el-text-color-secondary)]"
                      >{{ selectedRack.columns.length }} 列 · {{ selectedRack.levelCount }} 层 ·
                      {{ selectedRack.binCount }} 个库位</span
                    >
                  </div>
                  <div class="detail-section">
                    <div class="detail-section__heading"
                      ><strong>层位导航</strong><span>点击定位</span></div
                    >
                    <div class="detail-bin-list">
                      <div
                        v-for="column in selectedRack.columns"
                        :key="column.number"
                        class="space-y-1.5"
                      >
                        <span
                          class="block text-center text-[11px] text-[var(--el-text-color-secondary)]"
                          >{{ column.number }} 列</span
                        >
                        <button
                          v-for="bin in column.bins"
                          :key="bin.id"
                          type="button"
                          class="detail-bin"
                          :class="[
                            `tone-${binTone(bin)}`,
                            { 'is-selected': selectedBinId === bin.id }
                          ]"
                          :title="`${bin.binCode} · ${toneLabel(binTone(bin))}`"
                          :aria-label="`${bin.binCode}，${toneLabel(binTone(bin))}`"
                          :aria-pressed="selectedBinId === bin.id"
                          @click="focusBinFromNavigation(bin, selectedRack.code)"
                        >
                          {{ bin.levelNo || 1 }}F
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-if="selectedBin" class="detail-section">
                    <div class="detail-section__heading"
                      ><strong>库位信息</strong
                      ><span>{{ toneLabel(binTone(selectedBin)) }}</span></div
                    >
                    <dl class="detail-list">
                      <div
                        ><dt>库位编码</dt
                        ><dd class="break-all font-medium">{{ selectedBin.binCode }}</dd></div
                      >
                      <div
                        ><dt>名称</dt><dd>{{ selectedBin.binName }}</dd></div
                      >
                      <div
                        ><dt>位置</dt
                        ><dd
                          >{{ selectedBin.levelNo || 1 }} 层 ·
                          {{ selectedBin.columnNo || 1 }} 列</dd
                        ></div
                      >
                      <div
                        ><dt>在库物料</dt
                        ><dd>{{ binStat(selectedBin.id).materialCount }} 种</dd></div
                      >
                      <div
                        ><dt>在库数量</dt><dd>{{ binStat(selectedBin.id).quantity }}</dd></div
                      >
                      <div
                        ><dt>最大数量</dt><dd>{{ selectedBin.maxQuantity ?? '未设置' }}</dd></div
                      >
                    </dl>
                    <ElButton type="primary" plain class="mt-4 w-full" @click="openInventoryDetail"
                      >查看库存明细</ElButton
                    >
                  </div>
                  <p v-else class="text-xs text-[var(--el-text-color-secondary)]"
                    >点击立体场景或上方层位，查看该库位的库存与容量。</p
                  >
                </div>
                <ArtEmptyState
                  v-else
                  title="请选择货架"
                  description="从左侧选择库区，再点击中间的货架。"
                  size="compact"
                  :visual-size="64"
                />
              </ElScrollbar>
            </ArtSectionCard>
          </template>
        </ArtWorkspaceSplitter>
      </ArtWorkspaceSplitter>
      <InventoryDetailDialog ref="detailDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { groupBy, keyBy, uniq } from 'lodash-es'
  import { useLocalStorage } from '@vueuse/core'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import {
    fetchStorageBins,
    fetchStorageOverview,
    fetchStorageWarehouses,
    fetchStorageZones,
    type StorageBin,
    type StorageOverview,
    type StorageStockStat,
    type StorageWarehouse,
    type StorageZone
  } from '@mdm/api'
  import InventoryDetailDialog from '../storage/modules/inventory-detail-dialog.vue'
  import RackScene from './modules/rack-scene.vue'
  import type { BinTone, RackGroup } from './modules/types'

  defineOptions({ name: 'MdmWarehouseBin3d' })

  const warehouses = ref<StorageWarehouse[]>([])
  const zones = ref<StorageZone[]>([])
  const bins = ref<StorageBin[]>([])
  const overview = ref<StorageOverview>({ staleDays: 90, zones: [], bins: [] })
  const selectedWarehouseId = ref('')
  const selectedZoneId = ref('')
  const selectedRackCode = ref('')
  const selectedBinId = ref('')
  const viewMode = ref<'spatial' | 'top'>('spatial')
  const spacingOpen = ref(false)
  const loadingWarehouses = ref(false)
  const loadingBins = ref(false)
  const warehouseError = ref('')
  const binError = ref('')
  const detailDialogRef = ref<InstanceType<typeof InventoryDetailDialog>>()
  const sceneRef = ref<InstanceType<typeof RackScene>>()
  const spacing = useLocalStorage('mdm-bin-3d-spacing', { column: 20, level: 8 })
  let loadSequence = 0

  const selectedWarehouse = computed(() =>
    warehouses.value.find((row) => row.id === selectedWarehouseId.value)
  )
  const selectedZone = computed(() => zones.value.find((row) => row.id === selectedZoneId.value))
  const zoneBins = computed(() =>
    bins.value.filter(
      (bin) => bin.zoneId === (selectedZone.value?.id ?? null) && bin.binType === 'shelf'
    )
  )
  const stockByBinId = computed(() => keyBy(overview.value.bins, 'binId'))
  const emptyStock: StorageStockStat = {
    materialCount: 0,
    amount: 0,
    unpricedCount: 0,
    staleMaterialCount: 0,
    staleAmount: 0,
    staleUnpricedCount: 0,
    quantity: 0
  }
  const binStat = (id: string): StorageStockStat => stockByBinId.value[id] ?? emptyStock
  const binTone = (bin: StorageBin): BinTone => {
    if (bin.status === 'disabled') return 'disabled'
    if (bin.status !== 'available') return 'abnormal'
    return binStat(bin.id).quantity > 0 ? 'occupied' : 'available'
  }
  const toneLabel = (tone: BinTone): string =>
    ({ available: '空位', occupied: '有货', abnormal: '异常', disabled: '停用' })[tone]
  const racks = computed<RackGroup[]>(() =>
    Object.entries(groupBy(zoneBins.value, (bin) => bin.shelfCode || '未分组'))
      .map(([code, rackBins]) => ({
        code,
        columns: Object.entries(groupBy(rackBins, (bin) => bin.columnNo ?? 1))
          .map(([number, columnBins]) => ({
            number: Number(number),
            bins: [...columnBins].sort((a, b) => (b.levelNo ?? 0) - (a.levelNo ?? 0))
          }))
          .sort((a, b) => a.number - b.number),
        levelCount: uniq(rackBins.map((bin) => bin.levelNo ?? 1)).length,
        binCount: rackBins.length
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'zh-CN', { numeric: true }))
  )
  const selectedRack = computed(
    () => racks.value.find((rack) => rack.code === selectedRackCode.value) ?? racks.value[0]
  )
  const selectedBin = computed(() => zoneBins.value.find((bin) => bin.id === selectedBinId.value))
  const occupiedCount = computed(
    () => zoneBins.value.filter((bin) => binTone(bin) === 'occupied').length
  )
  const emptyCount = computed(
    () => zoneBins.value.filter((bin) => binTone(bin) === 'available').length
  )
  const zoneShelfCount = (zoneId: string | null): number =>
    uniq(
      bins.value
        .filter((bin) => bin.zoneId === zoneId && bin.binType === 'shelf')
        .map((bin) => bin.shelfCode || '未分组')
    ).length

  async function loadWarehouses(): Promise<void> {
    loadingWarehouses.value = true
    warehouseError.value = ''
    try {
      warehouses.value = await fetchStorageWarehouses()
      if (!warehouses.value.some((row) => row.id === selectedWarehouseId.value))
        selectedWarehouseId.value =
          warehouses.value.find((row) => row.enableLocations)?.id ?? warehouses.value[0]?.id ?? ''
      await loadBins()
    } catch {
      warehouseError.value = '仓库列表加载失败，请重试。'
    } finally {
      loadingWarehouses.value = false
    }
  }
  async function loadBins(): Promise<void> {
    const warehouseId = selectedWarehouseId.value
    const sequence = ++loadSequence
    if (!warehouseId) {
      zones.value = []
      bins.value = []
      return
    }
    loadingBins.value = true
    binError.value = ''
    try {
      const [zoneRows, binRows, stats] = await Promise.all([
        fetchStorageZones(warehouseId),
        fetchStorageBins(warehouseId),
        fetchStorageOverview(warehouseId)
      ])
      if (sequence !== loadSequence) return
      zones.value = zoneRows
      bins.value = binRows
      overview.value = stats
      if (
        selectedWarehouse.value?.enableZones &&
        !zones.value.some((row) => row.id === selectedZoneId.value)
      )
        selectedZoneId.value = zones.value[0]?.id ?? ''
      if (!selectedWarehouse.value?.enableZones) selectedZoneId.value = ''
      selectedRackCode.value = ''
      selectedBinId.value = ''
    } catch {
      if (sequence === loadSequence) binError.value = '货架空间加载失败，请重试。'
    } finally {
      if (sequence === loadSequence) loadingBins.value = false
    }
  }
  function selectWarehouse(id: string): void {
    if (id === selectedWarehouseId.value) return
    spacingOpen.value = false
    selectedWarehouseId.value = id
    selectedZoneId.value = ''
    void loadBins()
  }
  function selectZone(id: string): void {
    spacingOpen.value = false
    selectedZoneId.value = id
    selectedRackCode.value = ''
    selectedBinId.value = ''
  }
  function selectRack(code: string): void {
    spacingOpen.value = false
    selectedRackCode.value = code
    selectedBinId.value = ''
  }
  function selectBin(bin: StorageBin, rackCode: string): void {
    spacingOpen.value = false
    selectedRackCode.value = rackCode
    selectedBinId.value = bin.id
  }
  function focusBinFromNavigation(bin: StorageBin, rackCode: string): void {
    selectBin(bin, rackCode)
    sceneRef.value?.focusBin(bin.id)
  }
  function setViewMode(mode: 'spatial' | 'top'): void {
    spacingOpen.value = false
    viewMode.value = mode
  }
  function openInventoryDetail(): void {
    if (!selectedBin.value) return
    void detailDialogRef.value?.handleOpen({
      warehouseId: selectedBin.value.warehouseId,
      binId: selectedBin.value.id,
      label: selectedBin.value.binName
    })
  }
  onMounted(loadWarehouses)
</script>

<style scoped lang="scss">
  .overview-strip {
    min-width: 0;
  }

  .overview-metric {
    display: flex;
    gap: 6px;
    align-items: baseline;
    white-space: nowrap;
  }

  .overview-metric strong {
    font-size: 19px;
    font-variant-numeric: tabular-nums;
  }

  .overview-metric span {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .overview-metric.is-occupied strong {
    color: var(--el-color-success);
  }

  @media (width <= 640px) {
    .overview-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }

    .overview-strip > div:first-child {
      grid-column: 1 / -1;
    }

    .overview-metric {
      display: block;
      text-align: center;
    }

    .overview-metric strong,
    .overview-metric span {
      display: block;
    }
  }

  .scene-icon-button {
    color: var(--el-color-primary);
    border: 1px solid var(--el-color-primary-light-5);
    border-radius: var(--art-control-radius);
  }

  .nav-warehouse {
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }

  .nav-warehouse.is-current {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .nav-zone {
    color: var(--el-text-color-regular);
  }

  .nav-zone:hover,
  .nav-zone.is-current {
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }

  .nav-zone.is-current {
    font-weight: 600;
  }

  .view-switch {
    display: inline-flex;
    padding: 2px;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: var(--art-control-radius);
  }

  .view-switch button {
    min-width: 38px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    border-radius: calc(var(--art-control-radius) - 2px);
  }

  .view-switch button.is-current {
    font-weight: 600;
    color: var(--el-color-primary);
    background: var(--el-bg-color);
    box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  }

  .view-switch button:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  .scene-frame {
    min-height: 500px;
  }

  .scene-context {
    position: absolute;
    top: 16px;
    left: 18px;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: #d4e0f1;
    pointer-events: none;
  }

  .scene-context span {
    color: #9bb3d0;
  }

  .scene-context strong {
    font-size: 16px;
  }

  .scene-context small {
    font-size: 11px;
    color: #b7c6d9;
  }

  .scene-legend {
    position: absolute;
    bottom: 14px;
    left: 18px;
    z-index: 3;
    display: flex;
    flex-wrap: wrap;
    gap: 7px 13px;
    font-size: 11px;
    color: #d4e0f1;
    pointer-events: none;
  }

  .scene-legend span {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }

  .legend-dot.is-empty {
    background: #94a5ba;
  }

  .legend-dot.is-occupied {
    background: var(--el-color-success);
  }

  .legend-dot.is-abnormal {
    background: var(--el-color-warning);
  }

  .legend-dot.is-disabled {
    background: var(--el-color-info);
  }

  .detail-identity {
    padding-bottom: 15px;
    border-bottom: 1px solid var(--el-border-color);
  }

  .detail-section__heading {
    display: flex;
    gap: 8px;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 12px;
  }

  .detail-section__heading span {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .detail-bin-list {
    display: flex;
    gap: 8px;
    min-width: 0;
    max-height: 190px;
    padding: 2px;
    overflow: auto;
  }

  .detail-bin-list > div {
    flex: 1 0 38px;
    min-width: 38px;
  }

  .detail-bin {
    display: block;
    width: 100%;
    min-height: 28px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
    background: color-mix(in srgb, var(--bin-color) 13%, var(--el-bg-color));
    border: 1px solid var(--bin-color);
    border-radius: 4px;
  }

  .detail-bin.is-selected {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
  }

  .detail-bin:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  .tone-available {
    --bin-color: #94a5ba;
  }

  .tone-occupied {
    --bin-color: var(--el-color-success);
  }

  .tone-abnormal {
    --bin-color: var(--el-color-warning);
  }

  .tone-disabled {
    --bin-color: var(--el-color-info);
  }

  .detail-list > div {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  .detail-list dt {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
  }

  .detail-list dd {
    min-width: 0;
    text-align: right;
  }

  @media (width <= 640px) {
    .scene-context {
      top: 12px;
      left: 12px;
    }

    .scene-legend {
      right: 12px;
      bottom: 44px;
      left: 12px;
    }
  }
</style>
