<template>
  <ArtPermissionGuard permission="MdmInventorySerial:View" resource-name="序列号">
    <div class="business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="SERIAL TRACEABILITY"
        title="序列号"
        description="按单件标识追踪工单、物料属性、仓库与库位，并记录在库到出库的状态。"
        icon="ri:barcode-line"
        :tags="[
          { label: '单件追踪', type: 'primary' },
          { label: '物料主数据联动', type: 'success' }
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
        :search-bar-props="{ span: 8, labelWidth: 112, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无序列号',
          emptyDescription: '点击新增序列号，建立可追踪的单件身份。'
        }"
        focusable
      />
      <SerialDialog ref="dialogRef" @success="refresh" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
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
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchInventorySerials,
    fetchStorageWarehouses,
    type InventorySerial,
    type StorageWarehouse
  } from '@mdm/api'
  import SerialDialog from '../storage/modules/serial-dialog.vue'

  defineOptions({ name: 'MdmInventorySerial' })
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  void userStore.ensureDictLoaded('mdmInventorySerialStatus')
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<InstanceType<typeof SerialDialog>>()
  const warehouses = ref<StorageWarehouse[]>([])
  const search = reactive({ warehouseId: '', status: '', keyword: '' })
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
      label: '序列号 / 物料',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '序列号或物料编码' }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: getDictMap.value.mdmInventorySerialStatus ?? []
      }
    }
  ])
  const openDialog = (row?: InventorySerial): void => {
    const warehouse = row?.warehouseId
      ? warehouses.value.find((item) => item.id === row.warehouseId)
      : (selectedWarehouse.value ?? warehouses.value.find((item) => item.status === 'enabled'))
    if (warehouse) void dialogRef.value?.handleOpen({ warehouse, row })
  }
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'MdmInventorySerial:Add',
      type: 'add',
      label: '新增序列号',
      onClick: () => openDialog()
    }
  ]
  const columnsFactory = (): ColumnOption<InventorySerial>[] => [
    {
      prop: 'serialNo',
      label: '序列号',
      minWidth: 220,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.serialNo}
          secondary={row.workOrderNo || '未关联工单'}
          icon="ri:barcode-line"
        />
      )
    },
    {
      prop: 'materialId',
      label: '物料',
      minWidth: 210,
      formatter: (row) => `${row.materialName || '—'} · ${row.materialCode || ''}`
    },
    {
      prop: 'materialDescription',
      label: '物料描述',
      minWidth: 200,
      showOverflowTooltip: true,
      formatter: (row) => row.materialDescription || '—'
    },
    {
      prop: 'specificationModel',
      label: '规格型号',
      minWidth: 150,
      showOverflowTooltip: true,
      formatter: (row) => row.specificationModel || '—'
    },
    {
      prop: 'materialSource',
      label: '物料来源',
      minWidth: 115,
      formatter: (row) => row.materialSource || '—'
    },
    {
      prop: 'materialType',
      label: '物料类型',
      minWidth: 115,
      formatter: (row) => row.materialType || '—'
    },
    {
      prop: 'status',
      label: '序列号状态',
      minWidth: 125,
      formatter: (row) => (
        <ArtDictDisplay dictCode="mdmInventorySerialStatus" value={row.status} display="auto" />
      )
    },
    {
      prop: 'warehouseName',
      label: '仓库',
      minWidth: 140,
      formatter: (row) => row.warehouseName || '—'
    },
    { prop: 'binCode', label: '仓位', minWidth: 120, formatter: (row) => row.binCode || '—' },
    {
      prop: 'createTime',
      label: '创建时间',
      width: 170,
      formatter: (row) => dayjs(row.createTime).format('YYYY-MM-DD HH:mm')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 84,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="MdmInventorySerial:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchData = (params: {
    current: number
    size: number
    warehouseId?: string
    status?: string
    keyword?: string
  }) => fetchInventorySerials(params)
  const refresh = (): void => {
    void tableRef.value?.getData()
  }
  onMounted(async () => {
    warehouses.value = await fetchStorageWarehouses()
  })
</script>
