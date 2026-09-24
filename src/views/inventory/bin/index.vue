<template>
  <ArtPermissionGuard permission="MdmWarehouseBin:View" resource-name="库位">
    <div class="business-workspace-page art-full-height gap-4">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="库位管理"
        description="仓库、库区、库位三级联动；货架按层列展示，块状库位独立排列。"
        icon="ri:stack-line"
        :tags="[
          { label: '三级联动', type: 'primary' },
          { label: '货架层列', type: 'success' }
        ]"
      />

      <div
        class="grid min-h-0 gap-4 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(150px,1fr)_minmax(0,2fr)] xl:grid-cols-[210px_190px_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]"
      >
        <ArtSectionCard
          title="仓库"
          root-class="flex min-h-0 flex-col"
          body-class="min-h-0 flex-1"
          :loading="loadingWarehouses"
          :error="warehouseError"
          :empty="!loadingWarehouses && !warehouseError && !warehouses.length"
          empty-title="暂无仓库"
          @retry="loadWarehouses"
        >
          <ElScrollbar height="100%">
            <div class="space-y-2 pr-1">
              <button
                v-for="warehouse in warehouses"
                :key="warehouse.id"
                type="button"
                class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
                :class="
                  selectedWarehouseId === warehouse.id
                    ? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
                    : 'border-[var(--el-border-color)] hover:bg-[var(--el-fill-color-light)]'
                "
                :aria-pressed="selectedWarehouseId === warehouse.id"
                @click="selectWarehouse(warehouse.id)"
              >
                <span
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--el-color-primary-light-9)] text-[var(--el-color-primary)]"
                  aria-hidden="true"
                >
                  <ArtSvgIcon icon="ri:store-2-line" />
                </span>
                <span class="min-w-0 flex-1" :title="warehouse.warehouseName">
                  <strong class="block truncate text-sm">{{ warehouse.warehouseName }}</strong>
                  <small class="block truncate text-[var(--el-text-color-secondary)]">
                    {{ warehouse.warehouseCode }} ·
                    {{ warehouse.enableLocations ? '已启用' : '未启用' }}
                  </small>
                </span>
              </button>
            </div>
          </ElScrollbar>
        </ArtSectionCard>

        <ArtSectionCard
          title="库区"
          root-class="flex min-h-0 flex-col"
          body-class="min-h-0 flex-1"
          :subtitle="selectedWarehouse?.enableZones ? '选择库区查看库位' : '该仓库按仓库直挂库位'"
          :loading="loadingBins"
          :error="binError"
          @retry="loadBins"
        >
          <ElScrollbar height="100%">
            <div class="space-y-2 pr-1">
              <button
                v-if="selectedWarehouse && !selectedWarehouse.enableZones"
                type="button"
                class="w-full rounded-lg border border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)] px-3 py-3 text-left text-sm focus-visible:outline-2"
                aria-pressed="true"
              >
                仓库直挂
                <small class="mt-1 block text-[var(--el-text-color-secondary)]">无库区层级</small>
              </button>
              <button
                v-for="zone in zones"
                :key="zone.id"
                type="button"
                class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
                :class="
                  selectedZoneId === zone.id
                    ? 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]'
                    : 'border-[var(--el-border-color)] hover:bg-[var(--el-fill-color-light)]'
                "
                :aria-pressed="selectedZoneId === zone.id"
                @click="selectedZoneId = zone.id"
              >
                <span
                  class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--el-color-primary-light-9)] text-[var(--el-color-primary)]"
                  aria-hidden="true"
                >
                  <ArtSvgIcon icon="ri:layout-grid-line" />
                </span>
                <span class="min-w-0 flex-1" :title="zone.zoneName">
                  <strong class="block truncate text-sm">{{ zone.zoneName }}</strong>
                  <small class="block truncate text-[var(--el-text-color-secondary)]">{{
                    zone.zoneCode
                  }}</small>
                </span>
              </button>
              <p
                v-if="selectedWarehouse?.enableZones && !zones.length"
                class="py-8 text-center text-xs text-[var(--el-text-color-secondary)]"
              >
                暂无库区，请先到库区管理创建。
              </p>
            </div>
          </ElScrollbar>
        </ArtSectionCard>

        <ArtSectionCard
          title="库位"
          :subtitle="
            selectedWarehouse?.enableLocations
              ? `${selectedWarehouse.warehouseName}${selectedZone ? ` · ${selectedZone.zoneName}` : ''} · 点击库位办理业务，双击查看库存。`
              : '请先在仓库定义中启用仓位。'
          "
          root-class="flex min-h-0 flex-col lg:col-span-2 xl:col-span-1"
          body-class="min-h-0 flex-1 overflow-y-auto"
          :loading="loadingBins"
          :error="binError"
          :empty="!loadingBins && !binError && !visibleBins.length"
          :empty-title="selectedWarehouse?.enableLocations ? '暂无匹配库位' : '仓位层级未启用'"
          :empty-description="
            selectedWarehouse?.enableLocations
              ? '可新增块状库位，或按层数与列数批量生成货架单元。'
              : '启用仓位后即可维护库位主数据。'
          "
          @retry="loadBins"
        >
          <template #actions>
            <div class="flex flex-wrap gap-2">
              <ElButton
                v-auth="'MdmWarehouseBin:Generate'"
                :disabled="!canCreate"
                @click="openShelfGenerator"
              >
                <ArtSvgIcon icon="ri:layout-grid-line" class="mr-1" aria-hidden="true" />
                生成货架
              </ElButton>
              <ElButton
                v-auth="'MdmWarehouseBin:Add'"
                type="primary"
                plain
                :disabled="!canCreate"
                @click="openBinDialog()"
              >
                <ArtSvgIcon icon="ri:add-line" class="mr-1" aria-hidden="true" />
                新增库位
              </ElButton>
            </div>
          </template>

          <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span class="text-xs text-[var(--el-text-color-secondary)]">状态筛选</span>
            <ElCheckboxGroup v-model="selectedTones" size="small">
              <ElCheckbox v-for="option in toneOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </ElCheckbox>
            </ElCheckboxGroup>
            <ElCheckbox v-model="fixedOnly">仅看定容</ElCheckbox>
          </div>

          <div class="space-y-5">
            <section v-for="group in shelfGroups" :key="group.code" class="min-w-0">
              <header
                class="mb-2 flex flex-wrap items-center gap-2 border-b border-[var(--el-border-color)] pb-2"
              >
                <strong class="text-sm">{{ group.code }} 货架</strong>
                <ElTag size="small" effect="plain">{{ group.bins.length }} 个单元</ElTag>
              </header>
              <div class="space-y-2 overflow-x-auto pb-1">
                <div v-for="level in group.levels" :key="level.number" class="flex min-w-max gap-2">
                  <span
                    class="flex w-10 shrink-0 items-center text-xs text-[var(--el-text-color-secondary)]"
                  >
                    {{ level.number }}F
                  </span>
                  <div v-for="bin in level.bins" :key="bin.id" class="w-44 shrink-0">
                    <BinNode
                      :bin="bin"
                      :tone-for="binTone"
                      :stock-for="binStat"
                      :stale-days="overview.staleDays"
                      :parent-code="bin.parentId ? binById[bin.parentId]?.binCode : undefined"
                      compact
                      @select="selectBin"
                      @detail="openDetail"
                      @edit="openBinDialog"
                      @child="openBinDialog(undefined, $event.id)"
                      @remove="removeBin"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section v-if="blockBins.length" class="min-w-0">
              <header
                class="mb-2 border-b border-[var(--el-border-color)] pb-2 text-sm font-semibold"
              >
                平面 / 垛位 / 暂存
              </header>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <div v-for="bin in blockBins" :key="bin.id" class="min-w-0">
                  <BinNode
                    :bin="bin"
                    :tone-for="binTone"
                    :stock-for="binStat"
                    :stale-days="overview.staleDays"
                    :parent-code="bin.parentId ? binById[bin.parentId]?.binCode : undefined"
                    @select="selectBin"
                    @detail="openDetail"
                    @edit="openBinDialog"
                    @child="openBinDialog(undefined, $event.id)"
                    @remove="removeBin"
                  />
                </div>
              </div>
            </section>
          </div>
        </ArtSectionCard>
      </div>

      <BinDialog ref="binDialogRef" @success="loadBins" />
      <ShelfGeneratorDialog ref="shelfDialogRef" @success="loadBins" />
      <StorageActionDialog ref="actionDialogRef" @choose="openMovement" />
      <InventoryMovementDialog ref="movementDialogRef" @success="loadBins" />
      <InventoryDetailDialog ref="detailDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { keyBy } from 'lodash-es'
  import TreeUtils from '@/utils/tree'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteStorageBin,
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
  import BinNode from '../storage/modules/bin-node.vue'
  import BinDialog from '../storage/modules/bin-dialog.vue'
  import ShelfGeneratorDialog from '../storage/modules/shelf-generator-dialog.vue'
  import StorageActionDialog, {
    type StorageActionContext
  } from '../storage/modules/storage-action-dialog.vue'
  import InventoryMovementDialog from '../storage/modules/inventory-movement-dialog.vue'
  import InventoryDetailDialog from '../storage/modules/inventory-detail-dialog.vue'

  defineOptions({ name: 'MdmWarehouseBin' })
  type BinBranch = StorageBin & { children?: BinBranch[] }
  const treeUtils = new TreeUtils({ parentKey: 'parentId', deepClone: false })
  const { confirmDelete } = useArtFeedback()
  const warehouses = ref<StorageWarehouse[]>([])
  const zones = ref<StorageZone[]>([])
  const bins = ref<StorageBin[]>([])
  const overview = ref<StorageOverview>({ staleDays: 90, zones: [], bins: [] })
  const selectedWarehouseId = ref('')
  const selectedZoneId = ref('')
  const selectedTones = ref<string[]>(['available', 'occupied', 'abnormal', 'disabled'])
  const fixedOnly = ref(false)
  const toneOptions = [
    { value: 'available', label: '可存' },
    { value: 'occupied', label: '有库存' },
    { value: 'abnormal', label: '异常' },
    { value: 'disabled', label: '停用' }
  ]
  const loadingWarehouses = ref(false)
  const loadingBins = ref(false)
  const warehouseError = ref('')
  const binError = ref('')
  const binDialogRef = ref<InstanceType<typeof BinDialog>>()
  const shelfDialogRef = ref<InstanceType<typeof ShelfGeneratorDialog>>()
  const actionDialogRef = ref<InstanceType<typeof StorageActionDialog>>()
  const movementDialogRef = ref<InstanceType<typeof InventoryMovementDialog>>()
  const detailDialogRef = ref<InstanceType<typeof InventoryDetailDialog>>()
  const selectedWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === selectedWarehouseId.value)
  )
  const selectedZone = computed(
    () => zones.value.find((zone) => zone.id === selectedZoneId.value) ?? null
  )
  const canCreate = computed(
    () =>
      Boolean(selectedWarehouse.value?.enableLocations) &&
      selectedWarehouse.value?.status === 'enabled' &&
      (!selectedWarehouse.value?.enableZones || Boolean(selectedZone.value))
  )
  const emptyStock: StorageStockStat = {
    materialCount: 0,
    amount: 0,
    unpricedCount: 0,
    staleMaterialCount: 0,
    staleAmount: 0,
    staleUnpricedCount: 0,
    quantity: 0
  }
  const stockByBinId = computed(() => keyBy(overview.value.bins, 'binId'))
  const binStat = (id: string): StorageStockStat => stockByBinId.value[id] ?? emptyStock
  const binTone = (bin: StorageBin): 'available' | 'occupied' | 'abnormal' | 'disabled' => {
    if (bin.status === 'disabled') return 'disabled'
    if (bin.status !== 'available') return 'abnormal'
    return binStat(bin.id).quantity > 0 ? 'occupied' : 'available'
  }
  const visibleBins = computed(() =>
    bins.value.filter(
      (bin) =>
        bin.zoneId === (selectedZone.value?.id ?? null) &&
        selectedTones.value.includes(binTone(bin)) &&
        (!fixedOnly.value || Boolean(bin.fixedMaterialId))
    )
  )
  const binById = computed(() => keyBy(bins.value, 'id'))
  const visibleBinTree = computed(() => treeUtils.listToTree<BinBranch>(visibleBins.value))
  const shelfGroups = computed(() => {
    const shelfCodes = [
      ...new Set(
        visibleBinTree.value
          .filter((bin) => bin.binType === 'shelf')
          .map((bin) => bin.shelfCode || '未分组')
      )
    ]
    return shelfCodes.map((code) => {
      const groupBins = visibleBinTree.value.filter(
        (bin) => bin.binType === 'shelf' && (bin.shelfCode || '未分组') === code
      )
      const numbers = [...new Set(groupBins.map((bin) => bin.levelNo ?? 0))].sort((a, b) => b - a)
      return {
        code,
        bins: treeUtils.treeToList(groupBins),
        levels: numbers.map((number) => ({
          number,
          bins: groupBins
            .filter((bin) => (bin.levelNo ?? 0) === number)
            .sort((a, b) => (a.columnNo ?? 0) - (b.columnNo ?? 0))
        }))
      }
    })
  })
  const blockBins = computed(() => visibleBinTree.value.filter((bin) => bin.binType !== 'shelf'))

  async function loadWarehouses(): Promise<void> {
    loadingWarehouses.value = true
    warehouseError.value = ''
    try {
      warehouses.value = await fetchStorageWarehouses()
      if (!warehouses.value.some((warehouse) => warehouse.id === selectedWarehouseId.value))
        selectedWarehouseId.value =
          warehouses.value.find((warehouse) => warehouse.enableLocations)?.id ??
          warehouses.value[0]?.id ??
          ''
      await loadBins()
    } catch {
      warehouseError.value = '仓库列表加载失败，请重试。'
    } finally {
      loadingWarehouses.value = false
    }
  }
  async function loadBins(): Promise<void> {
    if (!selectedWarehouseId.value) {
      zones.value = []
      bins.value = []
      return
    }
    loadingBins.value = true
    binError.value = ''
    try {
      const [zoneRows, binRows, stats] = await Promise.all([
        fetchStorageZones(selectedWarehouseId.value),
        fetchStorageBins(selectedWarehouseId.value),
        fetchStorageOverview(selectedWarehouseId.value)
      ])
      zones.value = zoneRows
      bins.value = binRows
      overview.value = stats
      if (selectedWarehouse.value?.enableZones) {
        if (!zones.value.some((zone) => zone.id === selectedZoneId.value))
          selectedZoneId.value = zones.value[0]?.id ?? ''
      } else selectedZoneId.value = ''
    } catch {
      binError.value = '库位布局加载失败，请重试。'
    } finally {
      loadingBins.value = false
    }
  }
  function selectWarehouse(id: string): void {
    selectedWarehouseId.value = id
    selectedZoneId.value = ''
    void loadBins()
  }
  function selectBin(bin: StorageBin): void {
    if (!selectedWarehouse.value) return
    void actionDialogRef.value?.handleOpen({
      warehouseId: bin.warehouseId,
      tenantId: bin.tenantId,
      binId: bin.id,
      label: bin.binName,
      disabled: binTone(bin) === 'disabled' || binTone(bin) === 'abnormal'
    })
  }
  function openDetail(bin: StorageBin): void {
    void detailDialogRef.value?.handleOpen({
      warehouseId: bin.warehouseId,
      binId: bin.id,
      label: bin.binName
    })
  }
  function openBinDialog(row?: StorageBin, parentId?: string): void {
    if (!selectedWarehouse.value) return
    void binDialogRef.value?.handleOpen({
      warehouse: selectedWarehouse.value,
      zone: selectedZone.value,
      bins: bins.value,
      row,
      parentId
    })
  }
  function openShelfGenerator(): void {
    if (!selectedWarehouse.value) return
    void shelfDialogRef.value?.handleOpen({
      warehouse: selectedWarehouse.value,
      zone: selectedZone.value
    })
  }
  async function removeBin(bin: StorageBin): Promise<void> {
    await confirmDelete(`确定删除库位“${bin.binName}”吗？存在库存或子单元时无法删除。`)
    await deleteStorageBin(bin.id)
    await loadBins()
  }
  function openMovement(type: string, context: StorageActionContext): void {
    void movementDialogRef.value?.handleOpen(type, context)
  }
  onMounted(loadWarehouses)
</script>
