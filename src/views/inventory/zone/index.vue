<template>
  <ArtPermissionGuard permission="MdmWarehouseZone:View" resource-name="库区">
    <div class="business-workspace-page art-full-height gap-4">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="库区管理"
        description="按仓库查看库区布局，拖动调整顺序；悬浮查看库存，双击打开明细。"
        icon="ri:layout-grid-line"
        :tags="[
          { label: '库存主数据', type: 'primary' },
          { label: '拖动排序', type: 'info' }
        ]"
      />

      <div
        class="grid min-h-0 gap-4 lg:flex-1 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]"
      >
        <ArtSectionCard
          title="仓库"
          subtitle="选择已启用库区的仓库"
          root-class="flex min-h-0 flex-col"
          body-class="min-h-0 flex-1"
          :loading="loadingWarehouses"
          :error="warehouseError"
          :empty="!loadingWarehouses && !warehouseError && !warehouses.length"
          empty-title="暂无仓库"
          empty-description="请先在仓库定义中维护仓库。"
          @retry="loadWarehouses"
        >
          <ElScrollbar height="100%">
            <div class="space-y-2 pr-1">
              <button
                v-for="warehouse in warehouses"
                :key="warehouse.id"
                type="button"
                class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
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
                  <small class="block truncate text-[var(--el-text-color-secondary)]">{{
                    warehouse.warehouseCode
                  }}</small>
                </span>
                <ElTag
                  size="small"
                  :type="warehouse.enableZones ? 'success' : 'info'"
                  effect="plain"
                >
                  {{ warehouse.enableZones ? '已启用' : '未启用' }}
                </ElTag>
              </button>
            </div>
          </ElScrollbar>
        </ArtSectionCard>

        <ArtSectionCard
          title="库区"
          :subtitle="
            selectedWarehouse?.enableZones
              ? `${selectedWarehouse.warehouseName} · 点击库区办理业务，双击查看库存明细；拖动卡片可调整顺序。`
              : '请先在仓库定义中启用库区，再创建库区。'
          "
          root-class="flex min-h-0 flex-col"
          body-class="flex min-h-0 flex-1 flex-col"
          :loading="loadingZones"
          :error="zoneError"
          @retry="loadZones"
        >
          <template #actions>
            <div class="flex flex-wrap gap-2">
              <ElButton
                v-auth="'MdmWarehouseZone:Add'"
                type="primary"
                plain
                :disabled="
                  !selectedWarehouse?.enableZones || selectedWarehouse.status !== 'enabled'
                "
                @click="openZoneDialog()"
              >
                <ArtSvgIcon icon="ri:add-line" class="mr-1" aria-hidden="true" />
                新增库区
              </ElButton>
            </div>
          </template>

          <div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
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
            v-if="!visibleZones.length"
            class="min-h-0 flex-1"
            :title="selectedWarehouse?.enableZones ? '暂无匹配库区' : '库区层级未启用'"
            :description="
              hasActiveFilters
                ? '调整上方状态筛选，或重置筛选查看全部库区。'
                : selectedWarehouse?.enableZones
                  ? '点击新增库区，建立第一条库区主数据。'
                  : '该仓库暂不能维护库区业务数据。'
            "
            size="compact"
            :visual-size="80"
          >
            <ElButton v-if="hasActiveFilters" type="primary" plain @click="resetFilters">
              重置筛选
            </ElButton>
          </ArtEmptyState>
          <ElScrollbar v-else class="min-h-0 flex-1">
            <div class="grid grid-cols-1 gap-4 pr-2 pb-2 sm:grid-cols-2 2xl:grid-cols-3">
              <div
                v-for="zone in visibleZones"
                :key="zone.id"
                class="zone-tile min-w-0"
                :draggable="canSortZones"
                @dragstart="startZoneDrag(zone.id)"
                @dragover="allowZoneDrop"
                @drop.prevent="dropZone(zone.id)"
              >
                <StorageTile
                  :code="zone.zoneCode"
                  :name="zone.zoneName"
                  :detail="zone.category?.categoryName || '不限物料分类'"
                  :tone="zoneTone(zone)"
                  :stock="zoneStat(zone.id)"
                  :stale-days="overview.staleDays"
                  :fixed="zoneFixed(zone.id)"
                  :selected="selectedZoneId === zone.id"
                  with-actions
                  @select="selectZone(zone)"
                  @detail="openDetail(zone)"
                />
                <StorageCardActions
                  :name="zone.zoneName"
                  :actions="zoneActions"
                  overlay
                  @click="handleZoneAction($event, zone)"
                />
              </div>
            </div>
          </ElScrollbar>
        </ArtSectionCard>
      </div>

      <ZoneDialog ref="zoneDialogRef" @success="loadZones" />
      <StorageActionDialog ref="actionDialogRef" @choose="openMovement" />
      <InventoryMovementDialog ref="movementDialogRef" @success="loadZones" />
      <InventoryDetailDialog ref="detailDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useAuth } from '@/hooks/core/useAuth'
  import type { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import {
    deleteStorageZone,
    fetchStorageBins,
    fetchStorageOverview,
    fetchStorageWarehouses,
    fetchStorageZones,
    reorderStorageZones,
    type StorageBin,
    type StorageOverview,
    type StorageStockStat,
    type StorageWarehouse,
    type StorageZone
  } from '@mdm/api'
  import StorageTile from '../storage/modules/storage-tile.vue'
  import StorageCardActions from '../storage/modules/storage-card-actions.vue'
  import { storageToneOptions } from '../storage/modules/storage-tone'
  import ZoneDialog from '../storage/modules/zone-dialog.vue'
  import StorageActionDialog, {
    type StorageActionContext
  } from '../storage/modules/storage-action-dialog.vue'
  import InventoryMovementDialog from '../storage/modules/inventory-movement-dialog.vue'
  import InventoryDetailDialog from '../storage/modules/inventory-detail-dialog.vue'

  defineOptions({ name: 'MdmWarehouseZone' })
  const { confirmDelete } = useArtFeedback()
  const { hasAuth } = useAuth()
  const router = useRouter()
  const canSortZones = computed(() => hasAuth('MdmWarehouseZone:Sort'))
  const warehouses = ref<StorageWarehouse[]>([])
  const zones = ref<StorageZone[]>([])
  const bins = ref<StorageBin[]>([])
  const overview = ref<StorageOverview>({ staleDays: 90, zones: [], bins: [] })
  const selectedWarehouseId = ref('')
  const selectedZoneId = ref('')
  const selectedTones = ref<string[]>(['available', 'occupied', 'abnormal', 'disabled'])
  const fixedOnly = ref(false)
  const toneOptions = storageToneOptions
  const zoneActions: ButtonMoreItem[] = [
    { key: 'edit', label: '编辑库区', auth: 'MdmWarehouseZone:Edit' },
    {
      key: 'remove',
      label: '删除库区',
      auth: 'MdmWarehouseZone:Delete',
      color: 'var(--el-color-danger)'
    }
  ]
  const hasActiveFilters = computed(() => selectedTones.value.length !== 4 || fixedOnly.value)
  function resetFilters(): void {
    selectedTones.value = storageToneOptions.map((option) => option.value)
    fixedOnly.value = false
  }
  const loadingWarehouses = ref(false)
  const loadingZones = ref(false)
  const warehouseError = ref('')
  const zoneError = ref('')
  const draggedZoneId = ref('')
  const zoneDialogRef = ref<InstanceType<typeof ZoneDialog>>()
  const actionDialogRef = ref<InstanceType<typeof StorageActionDialog>>()
  const movementDialogRef = ref<InstanceType<typeof InventoryMovementDialog>>()
  const detailDialogRef = ref<InstanceType<typeof InventoryDetailDialog>>()
  const selectedWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === selectedWarehouseId.value)
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
  const zoneStat = (id: string): StorageStockStat =>
    overview.value.zones.find((stat) => stat.zoneId === id) ?? emptyStock
  const zoneFixed = (id: string): boolean =>
    bins.value.some((bin) => bin.zoneId === id && Boolean(bin.fixedMaterialId))
  const zoneTone = (zone: StorageZone): 'available' | 'occupied' | 'abnormal' | 'disabled' => {
    if (zone.status === 'disabled') return 'disabled'
    if (zone.abnormal) return 'abnormal'
    return zoneStat(zone.id).quantity > 0 ? 'occupied' : 'available'
  }
  const visibleZones = computed(() =>
    zones.value.filter(
      (zone) =>
        selectedTones.value.includes(zoneTone(zone)) && (!fixedOnly.value || zoneFixed(zone.id))
    )
  )

  async function loadWarehouses(): Promise<void> {
    loadingWarehouses.value = true
    warehouseError.value = ''
    try {
      warehouses.value = await fetchStorageWarehouses()
      if (!warehouses.value.some((warehouse) => warehouse.id === selectedWarehouseId.value))
        selectedWarehouseId.value =
          warehouses.value.find((warehouse) => warehouse.enableZones)?.id ??
          warehouses.value[0]?.id ??
          ''
      await loadZones()
    } catch {
      warehouseError.value = '仓库列表加载失败，请重试。'
    } finally {
      loadingWarehouses.value = false
    }
  }
  async function loadZones(): Promise<void> {
    if (!selectedWarehouseId.value) {
      zones.value = []
      bins.value = []
      return
    }
    loadingZones.value = true
    zoneError.value = ''
    try {
      const [zoneRows, binRows, stats] = await Promise.all([
        fetchStorageZones(selectedWarehouseId.value),
        fetchStorageBins(selectedWarehouseId.value),
        fetchStorageOverview(selectedWarehouseId.value)
      ])
      zones.value = zoneRows
      bins.value = binRows
      overview.value = stats
    } catch {
      zoneError.value = '库区布局加载失败，请重试。'
    } finally {
      loadingZones.value = false
    }
  }
  function selectWarehouse(id: string): void {
    selectedWarehouseId.value = id
    selectedZoneId.value = ''
    void loadZones()
  }
  function selectZone(zone: StorageZone): void {
    if (!selectedWarehouse.value) return
    selectedZoneId.value = zone.id
    void actionDialogRef.value?.handleOpen({
      warehouseId: selectedWarehouse.value.id,
      tenantId: selectedWarehouse.value.tenantId,
      zoneId: zone.id,
      label: zone.zoneName,
      disabled: zoneTone(zone) === 'disabled' || zoneTone(zone) === 'abnormal'
    })
  }
  function openDetail(zone: StorageZone): void {
    void detailDialogRef.value?.handleOpen({
      warehouseId: zone.warehouseId,
      zoneId: zone.id,
      label: zone.zoneName
    })
  }
  function openZoneDialog(row?: StorageZone): void {
    if (!selectedWarehouse.value) return
    void zoneDialogRef.value?.handleOpen({ warehouse: selectedWarehouse.value, row })
  }
  function handleZoneAction(item: ButtonMoreItem, zone: StorageZone): void {
    if (item.key === 'edit') openZoneDialog(zone)
    if (item.key === 'remove') void removeZone(zone)
  }
  async function removeZone(zone: StorageZone): Promise<void> {
    await confirmDelete(`确定删除库区“${zone.zoneName}”吗？已有库位或库存时无法删除。`)
    await deleteStorageZone(zone.id)
    await loadZones()
  }
  async function dropZone(targetId: string): Promise<void> {
    if (!canSortZones.value) return
    const sourceId = draggedZoneId.value
    draggedZoneId.value = ''
    if (!sourceId || sourceId === targetId) return
    const reordered = [...zones.value]
    const sourceIndex = reordered.findIndex((zone) => zone.id === sourceId)
    const targetIndex = reordered.findIndex((zone) => zone.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [source] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, source)
    try {
      await reorderStorageZones(reordered.map((zone) => zone.id))
      await loadZones()
    } catch {
      await loadZones()
    }
  }
  function startZoneDrag(id: string): void {
    if (canSortZones.value) draggedZoneId.value = id
  }
  function allowZoneDrop(event: DragEvent): void {
    if (canSortZones.value) event.preventDefault()
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

<style scoped lang="scss">
  .zone-tile {
    position: relative;
  }

  @media (hover: hover) and (pointer: fine) {
    .zone-tile:hover :deep(.storage-card-actions.is-overlay),
    .zone-tile:focus-within :deep(.storage-card-actions.is-overlay) {
      pointer-events: auto;
      opacity: 1;
    }
  }
</style>
