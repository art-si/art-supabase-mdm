<template>
  <ArtPermissionGuard permission="MdmInventoryReservation:View" resource-name="库存预留">
    <div class="business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY COMMITMENTS"
        title="库存预留"
        description="按工单锁定原料的仓库或库位数量；释放后恢复为可用库存。"
        icon="ri:lock-2-line"
        :tags="[
          { label: '工单锁料', type: 'primary' },
          { label: '可用量校验', type: 'success' }
        ]"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        :model-value="search"
        @update:model-value="replaceReactiveModel(search, $event)"
        :api-fn="fetchData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无库存预留',
          emptyDescription: '选择仓库新增预留，工单下达后可锁定原料。'
        }"
        focusable
      />
      <ReservationDialog ref="dialogRef" @success="refresh" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createDateTimeFormatter } from '@/utils/ui/format'

  import { replaceReactiveModel } from '@/utils/form/model'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import ArtTableQuery, {
    type ArtTableQueryExpose,
    type ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type { ColumnOption } from '@/types'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import {
    fetchInventoryReservations,
    fetchStorageWarehouses,
    releaseInventoryReservation,
    type InventoryReservation,
    type StorageWarehouse
  } from '@mdm/api'
  import ReservationDialog from '../../inventory/storage/modules/reservation-dialog.vue'

  const formatTableDateTime = createDateTimeFormatter({
    format: 'YYYY-MM-DD HH:mm',
    emptyText: '--',
    invalidText: '--'
  })

  defineOptions({ name: 'MdmInventoryReservation' })
  const { confirmDelete } = useArtFeedback()
  const statusOptions = useDictionaryOptions('mdmInventoryReservationStatus')
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<InstanceType<typeof ReservationDialog>>()
  const warehouses = ref<StorageWarehouse[]>([])
  const search = reactive({ warehouseId: '', status: '' })
  const selectedWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === search.warehouseId)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '仓库',
      key: 'warehouseId',
      type: 'select',
      props: {
        clearable: true,
        filterable: true,
        placeholder: '全部仓库',
        options: warehouses.value.map((warehouse) => ({
          label: `${warehouse.warehouseName} · ${warehouse.warehouseCode}`,
          value: warehouse.id
        }))
      }
    },
    {
      label: '预留状态',
      key: 'status',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: statusOptions
      }
    }
  ])
  const openDialog = (): void => {
    const warehouse =
      selectedWarehouse.value ??
      warehouses.value.find(
        (item) => item.status === 'enabled' && item.businessScopes.includes('picking')
      )
    if (warehouse) void dialogRef.value?.handleOpen({ warehouse })
  }
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'MdmInventoryReservation:Add',
      type: 'add',
      label: '新增预留',
      buttonProps: { plain: false },
      onClick: openDialog
    }
  ]
  const release = async (row: InventoryReservation): Promise<void> => {
    await confirmDelete(`确定释放工单“${row.workOrderNo || row.workOrderId}”的这条库存预留吗？`)
    await releaseInventoryReservation(row.id)
    refresh()
  }
  const columnsFactory = (): ColumnOption<InventoryReservation>[] => [
    {
      prop: 'workOrderNo',
      label: '工单号',
      minWidth: 170,
      fixed: 'left',
      formatter: (row) => row.workOrderNo || row.workOrderId
    },
    {
      prop: 'materialId',
      label: '原料物料',
      minWidth: 210,
      formatter: (row) => (
        <BusinessTableIdentityCell primary={row.materialName} secondary={row.materialCode} />
      )
    },
    { prop: 'warehouseName', label: '仓库', minWidth: 145 },
    {
      prop: 'binCode',
      label: '预留库位',
      minWidth: 130,
      formatter: (row) => row.binCode || '仓库直存'
    },
    { prop: 'reservedQuantity', label: '预留数量', minWidth: 115, align: 'right' },
    {
      prop: 'status',
      label: '状态',
      width: 110,
      formatter: (row) => (
        <ArtDictDisplay
          dictCode="mdmInventoryReservationStatus"
          value={row.status}
          display="auto"
        />
      )
    },
    {
      prop: 'createTime',
      label: '预留时间',
      width: 170,
      formatter: (row) => formatTableDateTime(row.createTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 84,
      fixed: 'right',
      formatter: (row) =>
        row.status === 'active' ? (
          <BusinessTableRowActions>
            <ArtButtonTable
              permission="MdmInventoryReservation:Release"
              type="delete"
              label="释放预留"
              onClick={() => release(row)}
            />
          </BusinessTableRowActions>
        ) : (
          '—'
        )
    }
  ]
  const fetchData = (params: {
    current: number
    size: number
    warehouseId?: string
    status?: string
  }) => fetchInventoryReservations(params)
  const refresh = (): void => {
    void tableRef.value?.getData()
  }
  onMounted(async () => {
    warehouses.value = await fetchStorageWarehouses()
  })
</script>
