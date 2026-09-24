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
              : '请先在仓库定义中开启仓位和库区，才能创建库区。'
          "
          root-class="flex min-h-0 flex-col"
          body-class="min-h-0 flex-1 overflow-y-auto"
          :loading="loadingZones"
          :error="zoneError"
          :empty="!loadingZones && !zoneError && !visibleZones.length"
          :empty-title="selectedWarehouse?.enableZones ? '当前仓库暂无库区' : '库区层级未启用'"
          :empty-description="
            selectedWarehouse?.enableZones
              ? '点击新增库区，建立第一条库区主数据。'
              : '该仓库暂不能维护库区业务数据。'
          "
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
              <ElCheckbox v-for="option in toneOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </ElCheckbox>
            </ElCheckboxGroup>
            <ElCheckbox v-model="fixedOnly">仅看定容</ElCheckbox>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <div
              v-for="zone in visibleZones"
              :key="zone.id"
              class="min-w-0 space-y-2"
              :draggable="canSortZones"
              @dragstart="startZoneDrag(zone.id)"
              @dragover="allowZoneDrop"
              @drop.prevent="dropZone(zone.id)"
            >
              <StorageTile
                :code="zone.zoneCode"
                :name="zone.zoneName"
                :tone="zoneTone(zone)"
                :stock="zoneStat(zone.id)"
                :stale-days="overview.staleDays"
                :fixed="zoneFixed(zone.id)"
                :selected="selectedZoneId === zone.id"
                @select="selectZone(zone)"
                @detail="openDetail(zone)"
              />
              <div class="flex min-w-0 items-center justify-between gap-2 px-1 text-xs">
                <span class="truncate text-[var(--el-text-color-secondary)]">
                  {{ zone.category?.categoryName || '不限物料分类' }}
                </span>
                <span class="flex shrink-0 items-center gap-1">
                  <ElButton
                    v-auth="'MdmWarehouseZone:Edit'"
                    text
                    size="small"
                    :aria-label="`编辑${zone.zoneName}`"
                    @click="openZoneDialog(zone)"
                  >
                    <ArtSvgIcon icon="ri:edit-line" class="mr-1" aria-hidden="true" />
                    编辑
                  </ElButton>
                  <ElButton
                    v-auth="'MdmWarehouseZone:Delete'"
                    text
                    type="danger"
                    size="small"
                    :aria-label="`删除${zone.zoneName}`"
                    @click="removeZone(zone)"
                  >
                    <ArtSvgIcon icon="ri:delete-bin-line" class="mr-1" aria-hidden="true" />
                    删除
                  </ElButton>
                </span>
              </div>
            </div>
          </div>
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
  import ZoneDialog from '../storage/modules/zone-dialog.vue'
  import StorageActionDialog, {
    type StorageActionContext
  } from '../storage/modules/storage-action-dialog.vue'
  import InventoryMovementDialog from '../storage/modules/inventory-movement-dialog.vue'
  import InventoryDetailDialog from '../storage/modules/inventory-detail-dialog.vue'

  defineOptions({ name: 'MdmWarehouseZone' })
  const { confirmDelete } = useArtFeedback()
  const { hasAuth } = useAuth()
  const canSortZones = computed(() => hasAuth('MdmWarehouseZone:Sort'))
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
      zoneBinIds: bins.value.filter((bin) => bin.zoneId === zone.id).map((bin) => bin.id),
      label: zone.zoneName
    })
  }
  function openZoneDialog(row?: StorageZone): void {
    if (!selectedWarehouse.value) return
    void zoneDialogRef.value?.handleOpen({ warehouse: selectedWarehouse.value, row })
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
    void movementDialogRef.value?.handleOpen(type, context)
  }
  onMounted(loadWarehouses)
</script>
