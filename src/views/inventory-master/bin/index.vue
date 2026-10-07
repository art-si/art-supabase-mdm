<template>
  <ArtPermissionGuard permission="MdmWarehouseBin:View" resource-name="库位">
    <div class="business-workspace-page art-full-height gap-4">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="库位管理"
        description="按仓库配置显示库区与库位层级；货架按层列展示，块状库位独立排列。"
        icon="ri:stack-line"
        :tags="[
          { label: '库位布局', type: 'primary' },
          { label: '货架层列', type: 'success' }
        ]"
      />

      <ArtWorkspaceSplitter
        primary-size="240px"
        primary-min="200px"
        primary-max="360px"
        :breakpoint="1200"
        stacked-primary-size="220px"
      >
        <template #primary>
          <ArtSectionCard
            :show-scrollbar="false"
            title="仓库"
            root-class="flex min-h-0 flex-col"
            body-class="min-h-0 flex-1"
            :loading="loadingWarehouses"
            :error="warehouseError"
            :empty="!loadingWarehouses && !warehouseError && !warehouses.length"
            empty-title="暂无仓库"
            empty-description="先在仓库主数据中建立仓库，再管理库区与库位。"
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
                      {{ warehouse.enableLocations ? '库位已启用' : '库位未启用' }}
                    </small>
                  </span>
                </button>
              </div>
            </ElScrollbar>
          </ArtSectionCard>
        </template>

        <ArtWorkspaceSplitter
          primary-size="240px"
          primary-min="200px"
          primary-max="360px"
          :breakpoint="1200"
          stacked-primary-size="220px"
        >
          <template #primary>
            <ArtSectionCard
              :show-scrollbar="false"
              title="库区"
              root-class="flex min-h-0 flex-col"
              body-class="min-h-0 flex-1"
              :subtitle="selectedWarehouse?.enableZones ? '选择库区查看库位' : '库位直接归属仓库'"
              :loading="loadingBins"
              :error="binError"
              :empty="Boolean(selectedWarehouse?.enableZones && !zones.length)"
              empty-title="暂无库区"
              empty-description="请先到库区管理创建，再返回选择库区。"
              :empty-visual-size="64"
              :min-height="160"
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
                    <small class="mt-1 block text-[var(--el-text-color-secondary)]"
                      >无库区层级</small
                    >
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
                </div>
              </ElScrollbar>
            </ArtSectionCard>
          </template>

          <ArtSectionCard
            :show-scrollbar="false"
            title="库位"
            :subtitle="
              selectedWarehouse?.enableLocations
                ? `${selectedWarehouse.warehouseName}${selectedZone ? ` · ${selectedZone.zoneName}` : ''} · 点击库位办理业务，双击查看库存。`
                : '请先在仓库定义中启用库位。'
            "
            root-class="flex min-h-0 flex-col"
            body-class="flex min-h-0 flex-1 flex-col"
            :loading="loadingBins"
            :error="binError"
            @retry="loadBins"
          >
            <template #actions>
              <div class="flex flex-wrap gap-2">
                <ElButton
                  v-auth="'MdmWarehouseBin:Delete'"
                  :disabled="!visibleBins.length || loadingBins || deleteBusy"
                  @click="selectionMode = !selectionMode"
                >
                  <ArtSvgIcon
                    :icon="selectionMode ? 'ri:close-line' : 'ri:checkbox-multiple-line'"
                    class="mr-1"
                    aria-hidden="true"
                  />
                  {{ selectionMode ? '退出多选' : '批量删除' }}
                </ElButton>
                <ElButton
                  v-if="selectionMode"
                  v-auth="'MdmWarehouseBin:Delete'"
                  type="danger"
                  plain
                  :disabled="!selectedBinIds.length || loadingBins"
                  :loading="deleteBusy"
                  @click="removeSelectedBins"
                >
                  <ArtSvgIcon icon="ri:delete-bin-line" class="mr-1" aria-hidden="true" />
                  删除选中（{{ selectedBinIds.length }}）
                </ElButton>
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
              <ElCheckbox
                v-if="selectionMode"
                :model-value="allVisibleSelected"
                :indeterminate="someVisibleSelected && !allVisibleSelected"
                :disabled="deleteBusy || loadingBins"
                @change="toggleVisibleSelection"
                >全选当前筛选库位</ElCheckbox
              >
              <span class="text-xs text-[var(--el-text-color-secondary)]">状态筛选</span>
              <ElCheckboxGroup v-model="selectedTones" size="small">
                <ElCheckbox
                  v-for="option in toneOptions"
                  :key="option.value"
                  :value="option.value"
                  :style="{
                    '--el-checkbox-checked-bg-color': option.color,
                    '--el-checkbox-checked-input-border-color': option.color,
                    '--el-checkbox-checked-text-color': option.color,
                    '--el-checkbox-input-border-color-hover': option.color
                  }"
                >
                  {{ option.label }}
                </ElCheckbox>
              </ElCheckboxGroup>
              <ElCheckbox v-model="fixedOnly" size="small">仅看定容</ElCheckbox>
              <ElButton v-if="hasActiveFilters" link type="primary" @click="resetFilters">
                重置筛选
              </ElButton>
            </div>

            <ArtEmptyState
              v-if="!visibleBins.length"
              class="min-h-0 flex-1"
              :title="selectedWarehouse?.enableLocations ? '暂无匹配库位' : '仓位层级未启用'"
              :description="
                hasActiveFilters
                  ? '调整上方状态筛选，或重置筛选查看全部库位。'
                  : selectedWarehouse?.enableLocations
                    ? '可新增块状库位，或按层数与列数批量生成货架单元。'
                    : '启用库位后即可维护库位主数据。'
              "
              size="compact"
              :visual-size="80"
            >
              <ElButton v-if="hasActiveFilters" type="primary" plain @click="resetFilters">
                重置筛选
              </ElButton>
            </ArtEmptyState>
            <ElScrollbar v-else class="min-h-0 flex-1">
              <div class="space-y-5 pr-2 pb-2">
                <RackFacade
                  v-for="group in shelfGroups"
                  :key="group.code"
                  :code="group.code"
                  :expanded="isShelfExpanded(group.code)"
                  :levels="group.levels"
                  :bin-count="group.bins.length"
                  :children="group.children"
                  :tone-for="binTone"
                  :stock-for="binStat"
                  :stale-days="overview.staleDays"
                  :parent-code-for="parentCodeFor"
                  :selection-mode="selectionMode"
                  :selected-bin-ids="selectedBinIds"
                  :selection-disabled="deleteBusy || loadingBins"
                  @check="toggleBinSelection"
                  @check-shelf="toggleShelfSelection(group.code)"
                  @select="selectBin"
                  @detail="openDetail"
                  @edit="openBinDialog"
                  @child="openBinDialog(undefined, $event.id)"
                  @remove="removeBin"
                  @toggle="toggleShelf(group.code)"
                  @edit-shelf="openShelfEditor(group.code)"
                />

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
                        :selection-mode="selectionMode"
                        :selected-bin-ids="selectedBinIds"
                        :selection-disabled="deleteBusy || loadingBins"
                        @check="toggleBinSelection"
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
            </ElScrollbar>
          </ArtSectionCard>
        </ArtWorkspaceSplitter>
      </ArtWorkspaceSplitter>

      <BinDialog ref="binDialogRef" @success="loadBins" />
      <ShelfGeneratorDialog ref="shelfDialogRef" @success="loadBins" />
      <ShelfEditorDialog ref="shelfEditorRef" @success="handleShelfUpdated" />
      <StorageActionDialog ref="actionDialogRef" @choose="openMovement" />
      <InventoryMovementDialog ref="movementDialogRef" @success="loadBins" />
      <InventoryDetailDialog ref="detailDialogRef" />
      <MasterDataDeleteGuard ref="deleteGuardRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { keyBy, uniq } from 'lodash-es'
  import TreeUtils from '@/utils/tree'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { ElMessage } from 'element-plus'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteStorageBins,
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
  import BinNode from '../../inventory/storage/modules/bin-node.vue'
  import { storageToneOptions } from '../../inventory/storage/modules/storage-tone'
  import RackFacade from './modules/rack-facade.vue'
  import BinDialog from '../../inventory/storage/modules/bin-dialog.vue'
  import ShelfGeneratorDialog from '../../inventory/storage/modules/shelf-generator-dialog.vue'
  import ShelfEditorDialog from './modules/shelf-editor-dialog.vue'
  import StorageActionDialog, {
    type StorageActionContext
  } from '../../inventory/storage/modules/storage-action-dialog.vue'
  import InventoryMovementDialog from '../../inventory/storage/modules/inventory-movement-dialog.vue'
  import InventoryDetailDialog from '../../inventory/storage/modules/inventory-detail-dialog.vue'

  defineOptions({ name: 'MdmWarehouseBin' })
  type BinBranch = StorageBin & { children?: BinBranch[] }
  const treeUtils = new TreeUtils({ parentKey: 'parentId', deepClone: false })
  const { confirmDelete } = useArtFeedback()
  const { hasAuth } = useAuth()
  const { deleteGuardRef, inspectDeleteReferences } = useRecordDeleteGuard(
    'mdm_warehouse_bin',
    '库位'
  )
  const deleteBusy = ref(false)
  const selectionMode = ref(false)
  const selectedBinIds = ref<string[]>([])
  const router = useRouter()
  const warehouses = ref<StorageWarehouse[]>([])
  const zones = ref<StorageZone[]>([])
  const bins = ref<StorageBin[]>([])
  const overview = ref<StorageOverview>({ staleDays: 90, zones: [], bins: [] })
  const selectedWarehouseId = ref('')
  const selectedZoneId = ref('')
  const expandedShelfCodes = ref<string[] | null>(null)
  const selectedTones = ref<string[]>(['available', 'occupied', 'abnormal', 'disabled'])
  const fixedOnly = ref(false)
  const toneOptions = storageToneOptions
  const hasActiveFilters = computed(() => selectedTones.value.length !== 4 || fixedOnly.value)
  function resetFilters(): void {
    selectedTones.value = storageToneOptions.map((option) => option.value)
    fixedOnly.value = false
  }
  const loadingWarehouses = ref(false)
  const loadingBins = ref(false)
  const warehouseError = ref('')
  const binError = ref('')
  const binDialogRef = ref<InstanceType<typeof BinDialog>>()
  const shelfDialogRef = ref<InstanceType<typeof ShelfGeneratorDialog>>()
  const shelfEditorRef = ref<InstanceType<typeof ShelfEditorDialog>>()
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
  const allVisibleSelected = computed(
    () =>
      visibleBins.value.length > 0 &&
      visibleBins.value.every((bin) => selectedBinIds.value.includes(bin.id))
  )
  const someVisibleSelected = computed(() =>
    visibleBins.value.some((bin) => selectedBinIds.value.includes(bin.id))
  )
  function toggleBinSelection(bin: StorageBin): void {
    if (deleteBusy.value || loadingBins.value) return
    selectedBinIds.value = selectedBinIds.value.includes(bin.id)
      ? selectedBinIds.value.filter((id) => id !== bin.id)
      : [...selectedBinIds.value, bin.id]
  }
  function toggleVisibleSelection(): void {
    if (deleteBusy.value || loadingBins.value) return
    selectedBinIds.value = allVisibleSelected.value
      ? selectedBinIds.value.filter((id) => !visibleBins.value.some((bin) => bin.id === id))
      : uniq([...selectedBinIds.value, ...visibleBins.value.map((bin) => bin.id)])
  }
  function toggleShelfSelection(code: string): void {
    if (deleteBusy.value || loadingBins.value) return
    const ids = bins.value
      .filter(
        (bin) =>
          bin.zoneId === (selectedZone.value?.id ?? null) &&
          bin.binType === 'shelf' &&
          (bin.shelfCode || '未分组') === code
      )
      .map((bin) => bin.id)
    selectedBinIds.value = ids.every((id) => selectedBinIds.value.includes(id))
      ? selectedBinIds.value.filter((id) => !ids.includes(id))
      : uniq([...selectedBinIds.value, ...ids])
  }
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
        children: groupBins.flatMap((bin) => bin.children ?? []),
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
  watch([selectedWarehouseId, selectedZoneId], () => {
    expandedShelfCodes.value = null
    selectedBinIds.value = []
    selectionMode.value = false
  })
  function isShelfExpanded(code: string): boolean {
    return expandedShelfCodes.value === null
      ? code === shelfGroups.value[0]?.code
      : expandedShelfCodes.value.includes(code)
  }
  function toggleShelf(code: string): void {
    const expanded =
      expandedShelfCodes.value ?? shelfGroups.value.slice(0, 1).map((group) => group.code)
    expandedShelfCodes.value = expanded.includes(code)
      ? expanded.filter((item) => item !== code)
      : [...expanded, code]
  }
  const parentCodeFor = (bin: StorageBin): string | undefined =>
    bin.parentId ? binById.value[bin.parentId]?.binCode : undefined

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
      selectedBinIds.value = selectedBinIds.value.filter((id) =>
        binRows.some((bin) => bin.id === id)
      )
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
    if (selectionMode.value) {
      toggleBinSelection(bin)
      return
    }
    if (!selectedWarehouse.value) return
    void actionDialogRef.value?.handleOpen({
      warehouseId: bin.warehouseId,
      tenantId: bin.tenantId,
      zoneId: bin.zoneId ?? undefined,
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
  function openShelfEditor(code: string): void {
    if (!selectedWarehouse.value) return
    void shelfEditorRef.value?.handleOpen({
      warehouse: selectedWarehouse.value,
      zone: selectedZone.value,
      code,
      bins: bins.value
    })
  }
  function handleShelfUpdated(code: string): void {
    expandedShelfCodes.value = [code]
    void loadBins()
  }
  async function removeBin(bin: StorageBin): Promise<void> {
    await removeBins([bin])
  }
  async function removeSelectedBins(): Promise<void> {
    await removeBins(bins.value.filter((bin) => selectedBinIds.value.includes(bin.id)))
  }
  async function removeBins(rows: StorageBin[]): Promise<void> {
    if (deleteBusy.value || !rows.length) return
    if (!hasAuth('MdmWarehouseBin:Delete')) {
      ElMessage.error('当前账号无权删除库位')
      return
    }
    if (rows.length > 500) {
      ElMessage.warning('单次最多删除 500 个库位，请减少选择后重试')
      return
    }
    const resources = rows.map((bin) => ({ id: bin.id, label: `${bin.binName} · ${bin.binCode}` }))
    deleteBusy.value = true
    try {
      if (await inspectDeleteReferences(resources)) return
      await confirmDelete(`确定删除选中的 ${rows.length} 个库位吗？此操作不可恢复。`)
      if (!hasAuth('MdmWarehouseBin:Delete')) {
        ElMessage.error('删除权限已变化，请刷新后重试')
        return
      }
      try {
        await deleteStorageBins(resources.map((item) => item.id))
      } catch (error) {
        if (await inspectDeleteReferences(resources)) return
        throw error
      }
      selectedBinIds.value = []
      ElMessage.success(`已删除 ${rows.length} 个库位`)
      await loadBins()
    } catch (error) {
      if (error !== 'cancel' && error !== 'close')
        notifyFriendlyError(error, '库位删除失败，请刷新核对后重试')
    } finally {
      deleteBusy.value = false
    }
  }
  function openMovement(type: string, context: StorageActionContext): void {
    if (type === 'sales_out' || type === 'production_in') {
      void router.push({
        path: '/wms/receipt-issue/stock-operation',
        query: { movementType: type, warehouseId: context.warehouseId }
      })
      return
    }
    void movementDialogRef.value?.handleOpen(type, context)
  }
  onMounted(loadWarehouses)
</script>
