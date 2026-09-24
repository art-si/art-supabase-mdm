<template>
  <ArtPermissionGuard permission="MdmInventoryBatch:View" resource-name="库存批次">
    <div class="business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY LEDGER"
        title="库存批次"
        description="按物料、仓库和库位追溯在库批次；入库、出库与调拨会同步生成收发存流水。"
        icon="ri:archive-stack-line"
        :tags="[
          { label: '批次余额', type: 'primary' },
          { label: '收发存可追溯', type: 'success' }
        ]"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ArtTableQuery
        ref="tableRef"
        v-model="search"
        :api-fn="fetchData"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无库存批次',
          emptyDescription: '选择仓库办理入库后，批次余额会显示在这里。'
        }"
        focusable
      />
      <InventoryMovementDialog ref="movementDialogRef" @success="refresh" />
      <InventoryPolicyDialog ref="policyDialogRef" @success="onPolicySaved" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import ArtTableQuery, {
    type ArtTableQueryExpose,
    type ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type { ColumnOption } from '@/types'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import {
    fetchInventoryBatches,
    fetchStorageWarehouses,
    type InventoryBatch,
    type InventoryBatchQuery,
    type StorageWarehouse
  } from '@mdm/api'
  import InventoryMovementDialog from '../storage/modules/inventory-movement-dialog.vue'
  import InventoryPolicyDialog from '../storage/modules/inventory-policy-dialog.vue'

  defineOptions({ name: 'MdmInventoryBatch' })
  const tableRef = ref<ArtTableQueryExpose>()
  const movementDialogRef = ref<InstanceType<typeof InventoryMovementDialog>>()
  const policyDialogRef = ref<InstanceType<typeof InventoryPolicyDialog>>()
  const warehouses = ref<StorageWarehouse[]>([])
  const search = reactive({
    warehouseId: '',
    keyword: '',
    positiveOnly: true
  })
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
      label: '批号 / 备注',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索批号或备注' }
    },
    {
      label: '仅看在库',
      key: 'positiveOnly',
      type: 'switch'
    }
  ])
  const contextFor = (row?: InventoryBatch) => {
    const warehouse = row
      ? warehouses.value.find((item) => item.id === row.warehouseId)
      : (selectedWarehouse.value ?? warehouses.value.find((item) => item.status === 'enabled'))
    if (!warehouse) return null
    return {
      warehouseId: warehouse.id,
      tenantId: warehouse.tenantId,
      label: row?.bin?.binName || warehouse.warehouseName,
      binId: row?.binId || undefined,
      batchId: row?.id
    }
  }
  const openMovement = (type: string, row?: InventoryBatch): void => {
    const context = contextFor(row)
    if (context) void movementDialogRef.value?.handleOpen(type, context)
  }
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'MdmInventoryBatch:Receive',
      label: '办理入库',
      icon: 'ri:inbox-archive-line',
      onClick: () => openMovement('purchase_in')
    },
    {
      permission: 'MdmInventoryBatch:Issue',
      label: '办理出库',
      icon: 'ri:logout-box-r-line',
      onClick: () => openMovement('other_out')
    },
    {
      permission: 'MdmInventoryBatch:Transfer',
      label: '办理调拨',
      icon: 'ri:swap-2-line',
      onClick: () => openMovement('transfer')
    },
    {
      permission: 'MdmInventoryBatch:Configure',
      label: '呆滞口径',
      icon: 'ri:settings-3-line',
      onClick: () => {
        const warehouse = selectedWarehouse.value ?? warehouses.value[0]
        if (warehouse)
          void policyDialogRef.value?.handleOpen({
            tenantId: warehouse.tenantId,
            warehouseName: warehouse.warehouseName
          })
      }
    }
  ]
  const columnsFactory = (): ColumnOption<InventoryBatch>[] => [
    {
      prop: 'materialId',
      label: '物料',
      minWidth: 230,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.material?.materialName || '未关联物料'}
          secondary={row.material?.materialCode || row.materialId}
          icon="ri:stack-line"
        />
      )
    },
    { prop: 'batchNo', label: '批号', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'warehouseId',
      label: '仓库',
      minWidth: 145,
      formatter: (row) => row.warehouse?.warehouseName || '—'
    },
    {
      prop: 'binId',
      label: '库位',
      minWidth: 130,
      formatter: (row) => row.bin?.binCode || '仓库直存'
    },
    { prop: 'quantity', label: '在库数量', minWidth: 105, align: 'right' },
    {
      prop: 'areaSqm',
      label: '面积 ㎡',
      minWidth: 100,
      align: 'right',
      formatter: (row) => row.areaSqm ?? '—'
    },
    {
      prop: 'specification',
      label: '规格 长×宽×厚',
      minWidth: 150,
      formatter: (row) =>
        [row.lengthMm, row.widthMm, row.thicknessMm].every((value) => value !== null)
          ? `${row.lengthMm} × ${row.widthMm} × ${row.thicknessMm}`
          : row.material?.specificationModel || '—'
    },
    {
      prop: 'amount',
      label: '库存金额',
      minWidth: 125,
      align: 'right',
      formatter: (row) =>
        row.unitCost === null ? '待核价' : formatCurrencyValue(row.quantity * row.unitCost)
    },
    {
      prop: 'lastMovementAt',
      label: '最后出入库',
      width: 170,
      formatter: (row) => dayjs(row.lastMovementAt).format('YYYY-MM-DD HH:mm')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 140,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="MdmInventoryBatch:Issue"
            type="edit"
            label="出库"
            icon="ri:logout-box-r-line"
            onClick={() => openMovement('other_out', row)}
          />
          <ArtButtonTable
            permission="MdmInventoryBatch:Transfer"
            type="edit"
            label="调拨"
            icon="ri:swap-2-line"
            onClick={() => openMovement('transfer', row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchData = (
    params: InventoryBatchQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>
  ) => fetchInventoryBatches(params)
  const refresh = (): void => {
    void tableRef.value?.getData()
  }
  const onPolicySaved = (): void => refresh()
  onMounted(async () => {
    warehouses.value = await fetchStorageWarehouses()
  })
</script>
