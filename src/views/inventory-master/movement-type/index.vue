<template>
  <ArtPermissionGuard permission="MdmStockMovementType:View" resource-name="出入库类型">
    <div class="business-workspace-page art-full-height min-w-0">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="出入库类型"
        description="统一维护移动类型编码、库存方向与冲销关系，供仓储作业识别和追溯。"
        icon="ri:swap-box-line"
        :tags="[
          { label: '库存主数据', type: 'primary' },
          { label: '入库 · 出库 · 库存转移', type: 'info' }
        ]"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <ElAlert v-if="optionError" type="warning" :closable="false" show-icon class="mb-3">
        类型字典加载失败，部分标签暂不可见。
        <ElButton link type="primary" @click="loadOptions">重新加载</ElButton>
      </ElAlert>
      <ArtTableQuery
        ref="tableRef"
        :model-value="search"
        @update:model-value="replaceReactiveModel(search, $event)"
        :api-fn="fetchRows"
        :search-items="searchItems"
        :columns-factory="columnsFactory"
        :header-actions="headerActions"
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '当前范围暂无出入库类型',
          emptyDescription: '点击新增，建立第一条可供仓储业务引用的移动类型。'
        }"
        focusable
      />
      <MovementTypeDialog ref="dialogRef" @success="refresh" />
      <MovementTypeDetailDrawer ref="detailRef" />
      <MasterDataDeleteGuard ref="deleteGuardRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { replaceReactiveModel } from '@/utils/form/model'
  import dayjs from 'dayjs'
  import { ElButton, ElTag } from 'element-plus'
  import { storeToRefs } from 'pinia'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import {
    deleteMovementTypes,
    exportMovementTypes,
    fetchMovementTypePage,
    type MovementDirection,
    type MovementTypeQuery,
    type MovementTypeRecord
  } from '@mdm/api'
  import MovementTypeDialog, {
    type MovementTypeDialogOpenData
  } from './modules/movement-type-dialog.vue'
  import MovementTypeDetailDrawer from './modules/movement-type-detail-drawer.vue'

  defineOptions({ name: 'MdmStockMovementType' })
  type SearchModel = { keyword: string; direction?: MovementDirection }
  type TableParams = SearchModel & Pick<MovementTypeQuery, 'current' | 'size'>
  type ExportRow = MovementTypeRecord & {
    directionLabel: string
    reverseTypeLabel: string
    reversalLabel: string
    otherIoLabel: string
    statusLabel: string
  }

  const tenantScopeStore = useTenantScopeStore()
  const userStore = useUserStore()
  const { effectiveTenantId, isAllTenants, tenantOptions } = storeToRefs(tenantScopeStore)
  const { deleteGuardRef, deleteRecords } = useRecordDeleteGuard(
    'mdm_stock_movement_type',
    '出入库类型'
  )
  const route = useRoute()
  const referencedRecordNo = computed(() =>
    route.query.fromMasterDelete === '1' &&
    route.query.dependencyCode === 'mdm_stock_movement_type' &&
    typeof route.query.recordNo === 'string'
      ? route.query.recordNo
      : ''
  )
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<InstanceType<typeof MovementTypeDialog>>()
  const detailRef = ref<InstanceType<typeof MovementTypeDetailDrawer>>()
  const optionError = ref(false)
  const search = reactive<SearchModel>({ keyword: referencedRecordNo.value, direction: undefined })
  const directionOptions = useDictionaryOptions('mdmStockMovementDirection')
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'keyword',
      label: '综合查询',
      type: 'input',
      props: { clearable: true, placeholder: '输入移动类型编码或名称' }
    },
    {
      key: 'direction',
      label: '出入标志',
      type: 'select',
      props: { clearable: true, placeholder: '全部类型', options: directionOptions }
    }
  ])
  const fetchRows = (params: TableParams, options?: { signal?: AbortSignal }) =>
    fetchMovementTypePage({ ...params, tenantId: effectiveTenantId.value }, options)

  function openDialog(mode: MovementTypeDialogOpenData['mode'], row?: MovementTypeRecord): void {
    void dialogRef.value?.handleOpen({
      mode,
      row,
      tenantId: row?.tenantId || effectiveTenantId.value
    })
  }
  function openDetail(row: MovementTypeRecord): void {
    void detailRef.value?.handleOpen(row)
  }
  async function refresh(): Promise<void> {
    await tableRef.value?.refreshUpdate()
  }
  async function removeRow(row: MovementTypeRecord): Promise<void> {
    await removeRows([row])
  }
  async function removeRows(rows: MovementTypeRecord[]): Promise<void> {
    const resources = rows.map((row) => ({
      id: row.id,
      label: `${row.movementCode} · ${row.movementName}`
    }))
    await deleteRecords({
      resources,
      permission: 'MdmStockMovementType:Delete',
      remove: () => deleteMovementTypes(resources.map((resource) => resource.id)),
      onDeleted: async () => tableRef.value?.refreshRemove()
    })
  }
  const toExportRow = (row: MovementTypeRecord): ExportRow => ({
    ...row,
    directionLabel: userStore.getDictDisplayLabelByValue(
      'mdmStockMovementDirection',
      row.direction
    ),
    reverseTypeLabel: row.reverseType
      ? `${row.reverseType.movementCode} · ${row.reverseType.movementName}`
      : '',
    reversalLabel: userStore.getDictDisplayLabelByValue(
      'commonBoolean',
      String(row.reversal ?? '')
    ),
    otherIoLabel: userStore.getDictDisplayLabelByValue('commonBoolean', String(row.otherIo ?? '')),
    statusLabel: row.status === 'enabled' ? '启用' : '禁用'
  })
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'MdmStockMovementType:Add',
      type: 'add',
      label: '新增类型',
      buttonProps: { plain: false },
      onClick: () => openDialog('add')
    },
    {
      permission: 'MdmStockMovementType:Copy',
      key: 'copy',
      label: '复制',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
      onClick: ({ selectedRows }) => openDialog('copy', selectedRows[0] as MovementTypeRecord)
    },
    {
      permission: 'MdmStockMovementType:Delete',
      type: 'delete',
      confirm: false,
      onClick: ({ selectedRows }) => removeRows(selectedRows as MovementTypeRecord[])
    },
    {
      permission: 'MdmStockMovementType:Export',
      type: 'export',
      label: '导出',
      exportFilename: () => `出入库类型_${dayjs().format('YYYYMMDD_HHmm')}`,
      exportSheetName: '出入库类型',
      exportColumns: [
        { key: 'movementCode', title: '移动类型编码' },
        { key: 'movementName', title: '移动类型名称' },
        { key: 'directionLabel', title: '出入标志' },
        { key: 'reverseTypeLabel', title: '反向类型' },
        { key: 'reversalLabel', title: '冲销标志' },
        { key: 'otherIoLabel', title: '其他出入库' },
        { key: 'statusLabel', title: '启用状态' },
        { key: 'remark', title: '备注' }
      ],
      exportApi: async ({ selectedRows, searchParams, maxRows }) => {
        await Promise.all(
          ['mdmStockMovementDirection', 'commonBoolean'].map((code) =>
            userStore.ensureDictLoaded(code)
          )
        )
        const rows = selectedRows.length
          ? (selectedRows as MovementTypeRecord[])
          : await exportMovementTypes(
              {
                tenantId: effectiveTenantId.value,
                keyword: String(searchParams.keyword || ''),
                direction:
                  searchParams.direction === 'inbound' ||
                  searchParams.direction === 'outbound' ||
                  searchParams.direction === 'transfer'
                    ? searchParams.direction
                    : undefined
              },
              maxRows
            )
        return rows.map(toExportRow)
      }
    }
  ]

  function columnsFactory(): ColumnOption<MovementTypeRecord>[] {
    return [
      { type: 'selection', width: 48 },
      { type: 'globalIndex', label: '序号', width: 72 },
      {
        prop: 'movementCode',
        label: '移动类型编码',
        minWidth: 170,
        formatter: (row) => (
          <span class="font-mono text-sm font-semibold text-[var(--el-text-color-primary)]">
            {row.movementCode}
          </span>
        )
      },
      {
        prop: 'movementName',
        label: '移动类型名称',
        minWidth: 190,
        showOverflowTooltip: true,
        formatter: (row) => (
          <strong class="font-medium text-[var(--el-text-color-primary)]">
            {row.movementName}
          </strong>
        )
      },
      {
        prop: 'direction',
        label: '出入标志',
        width: 132,
        dict: { code: 'mdmStockMovementDirection', display: 'auto' }
      },
      {
        prop: 'reverseTypeId',
        label: '反向类型',
        minWidth: 180,
        showOverflowTooltip: true,
        formatter: (row) =>
          row.reverseType
            ? `${row.reverseType.movementCode} · ${row.reverseType.movementName}`
            : '—'
      },
      {
        prop: 'reversal',
        label: '冲销标志',
        width: 112,
        align: 'center',
        formatter: (row) => (
          <ArtDictDisplay
            dictCode="commonBoolean"
            value={String(row.reversal ?? '')}
            display="text"
          />
        )
      },
      {
        prop: 'otherIo',
        label: '其他出入库',
        width: 118,
        align: 'center',
        formatter: (row) => (
          <ArtDictDisplay
            dictCode="commonBoolean"
            value={String(row.otherIo ?? '')}
            display="text"
          />
        )
      },
      {
        prop: 'status',
        label: '启用状态',
        width: 112,
        align: 'center',
        formatter: (row) => (
          <ElTag type={row.status === 'enabled' ? 'success' : 'info'} effect="light">
            {row.status === 'enabled' ? '启用' : '禁用'}
          </ElTag>
        )
      },
      { prop: 'remark', label: '备注', minWidth: 200, showOverflowTooltip: true },
      ...(isAllTenants.value
        ? [
            {
              prop: 'tenantId',
              label: '所属租户',
              minWidth: 175,
              formatter: (row: MovementTypeRecord) =>
                tenantOptions.value.find((tenant) => tenant.id === row.tenantId)?.tenantName ||
                '未知租户'
            } satisfies ColumnOption<MovementTypeRecord>
          ]
        : []),
      {
        prop: 'operation',
        label: '操作',
        width: 160,
        fixed: 'right',
        formatter: (row) => (
          <BusinessTableRowActions>
            <ArtButtonTable
              type="view"
              label="查看类型"
              permission="MdmStockMovementType:View"
              onClick={() => openDetail(row)}
            />
            <ArtButtonTable
              type="edit"
              label="编辑类型"
              permission="MdmStockMovementType:Edit"
              onClick={() => openDialog('edit', row)}
            />
            <ArtButtonMore
              trigger="click"
              list={[
                {
                  key: 'copy',
                  label: '复制类型',
                  icon: 'ri:file-copy-line',
                  auth: 'MdmStockMovementType:Copy'
                },
                {
                  key: 'delete',
                  label: '删除类型',
                  icon: 'ri:delete-bin-6-line',
                  color: 'var(--el-color-danger)',
                  auth: 'MdmStockMovementType:Delete'
                }
              ]}
              onClick={(item) =>
                item.key === 'copy' ? openDialog('copy', row) : void removeRow(row)
              }
            />
          </BusinessTableRowActions>
        )
      }
    ]
  }
  async function loadOptions(): Promise<void> {
    optionError.value = false
    try {
      await tenantScopeStore.loadTenantOptions()
      await Promise.all([
        userStore.ensureDictLoaded('mdmStockMovementDirection'),
        userStore.ensureDictLoaded('commonBoolean')
      ])
    } catch {
      optionError.value = true
    }
  }
  onMounted(() => void loadOptions())
  watch(referencedRecordNo, (recordNo) => {
    search.keyword = recordNo
    search.direction = undefined
    void tableRef.value?.getData()
  })
</script>
