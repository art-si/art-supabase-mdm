<template>
  <ArtPermissionGuard permission="MdmInventoryPackage:View" resource-name="垛包">
    <div class="business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="PACK PLACEMENT"
        title="垛包管理"
        description="直接引用 MES 排包包主表和包内板材明细，维护包号与仓库、库位的落位关系。"
        icon="ri:archive-drawer-line"
        :tags="[
          { label: 'MES 排包共用', type: 'success' },
          { label: '按库位落位', type: 'primary' }
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
        :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无垛包',
          emptyDescription: 'MES 排包生成包号后，可在这里查看明细并安排落位。'
        }"
        focusable
      />
      <PackagePlacementDialog ref="placementDialogRef" @success="refresh" />
      <PackageDetailDialog ref="detailDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import ArtTableQuery, {
    type ArtTableQueryExpose
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    fetchInventoryPackages,
    fetchStorageBins,
    fetchStorageWarehouses,
    unplaceInventoryPackage,
    type InventoryPackage,
    type StorageBin,
    type StorageWarehouse
  } from '@mdm/api'
  import PackagePlacementDialog from '../storage/modules/package-placement-dialog.vue'
  import PackageDetailDialog from '../storage/modules/package-detail-dialog.vue'

  defineOptions({ name: 'MdmInventoryPackage' })
  const { confirmDelete } = useArtFeedback()
  const tableRef = ref<ArtTableQueryExpose>()
  const placementDialogRef = ref<InstanceType<typeof PackagePlacementDialog>>()
  const detailDialogRef = ref<InstanceType<typeof PackageDetailDialog>>()
  const warehouses = ref<StorageWarehouse[]>([])
  const bins = ref<StorageBin[]>([])
  const search = reactive({ warehouseId: '', keyword: '' })
  const selectedWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === search.warehouseId)
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '仓库',
      key: 'warehouseId',
      type: 'select',
      props: {
        filterable: true,
        placeholder: '选择仓库',
        options: warehouses.value.map((warehouse) => ({
          label: `${warehouse.warehouseName} · ${warehouse.warehouseCode}`,
          value: warehouse.id
        }))
      }
    },
    {
      label: '包号 / 工单号',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索包号或工单号' }
    }
  ])
  const openPlacement = (pack: InventoryPackage): void => {
    if (selectedWarehouse.value)
      void placementDialogRef.value?.handleOpen({ pack, warehouse: selectedWarehouse.value })
  }
  const unplace = async (pack: InventoryPackage): Promise<void> => {
    if (!pack.placementId) return
    await confirmDelete(`确定解除包号“${pack.packNo}”的库位落位吗？`)
    await unplaceInventoryPackage(pack.placementId)
    refresh()
  }
  const columnsFactory = (): ColumnOption<InventoryPackage>[] => [
    {
      prop: 'packNo',
      label: '包号',
      minWidth: 180,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.packNo}
          secondary={row.workOrderNo}
          icon="ri:archive-drawer-line"
        />
      )
    },
    {
      prop: 'constructionNo',
      label: '项目施工号',
      minWidth: 155,
      formatter: (row) => row.constructionNo || '—'
    },
    { prop: 'itemCount', label: '板材种类', minWidth: 105, align: 'right' },
    { prop: 'pieceCount', label: '包内片数', minWidth: 105, align: 'right' },
    {
      prop: 'binId',
      label: '存放库位',
      minWidth: 150,
      formatter: (row) =>
        row.binId
          ? bins.value.find((bin) => bin.id === row.binId)?.binCode || '已落位'
          : row.placementId
            ? '仓库直存'
            : '未落位'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 190,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="MdmInventoryPackage:View"
            type="view"
            label="包内明细"
            onClick={() => detailDialogRef.value?.handleOpen(row)}
          />
          <ArtButtonTable
            permission="MdmInventoryPackage:Assign"
            type="edit"
            label="安排落位"
            onClick={() => openPlacement(row)}
          />
          {row.placementId ? (
            <ArtButtonTable
              permission="MdmInventoryPackage:Unassign"
              type="delete"
              label="解除落位"
              onClick={() => unplace(row)}
            />
          ) : null}
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchData = (params: {
    current: number
    size: number
    warehouseId?: string
    keyword?: string
  }) => {
    if (!params.warehouseId)
      return Promise.resolve({
        data: [] as InventoryPackage[],
        total: 0,
        current: params.current,
        size: params.size
      })
    return fetchInventoryPackages({
      warehouseId: params.warehouseId,
      keyword: params.keyword,
      current: params.current,
      size: params.size
    })
  }
  const refresh = (): void => {
    void tableRef.value?.getData()
  }
  watch(
    () => search.warehouseId,
    async (id) => {
      bins.value = id ? await fetchStorageBins(id) : []
    }
  )
  onMounted(async () => {
    warehouses.value = await fetchStorageWarehouses()
    search.warehouseId = warehouses.value[0]?.id ?? ''
    refresh()
  })
</script>
