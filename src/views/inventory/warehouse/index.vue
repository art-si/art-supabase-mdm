<template>
  <ArtPermissionGuard permission="MdmWarehouseDefinition:View" resource-name="仓库定义">
    <div class="warehouse-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="仓库定义"
        description="统一维护仓库分组、仓库身份与负责人，为采购、库存和出库业务提供可靠引用。"
        icon="ri:store-2-line"
        :tags="[
          { label: '库存主数据', type: 'primary' },
          { label: '员工花名册联动', type: 'success' }
        ]"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="warehouse-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="292px"
          primary-min="248px"
          primary-max="390px"
          :breakpoint="1080"
          stacked-primary-size="300px"
        >
          <template #primary>
            <WarehouseGroupPanel
              :groups="groups"
              :selected-id="selectedGroupId"
              :loading="groupState.loading"
              :error="groupState.error"
              @select="selectGroup"
              @refresh="refresh"
              @add="openChildGroupDialog"
              @edit="openGroupDialog"
              @remove="removeGroup"
            />
          </template>

          <div class="warehouse-page__table-pane">
            <ArtTableQuery
              ref="tableRef"
              v-model="search"
              :api-fn="fetchData"
              :search-items="searchItems"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: selectedGroupId ? '当前分组暂无仓库' : '暂无仓库主数据',
                emptyDescription: selectedGroupId
                  ? '可在当前分组新增仓库，或切换到全部仓库。'
                  : '点击新增仓库，建立第一条库存主数据。'
              }"
              focusable
            />
          </div>
        </ArtWorkspaceSplitter>
      </div>

      <WarehouseDialog ref="warehouseDialogRef" @success="refresh" />
      <WarehouseGroupDialog ref="groupDialogRef" @success="refresh" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import dayjs from 'dayjs'
  import { ElTag } from 'element-plus'
  import { cloneDeep } from 'lodash-es'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
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
  import {
    deleteWarehouseGroup,
    deleteWarehouses,
    fetchWarehouseWorkspace,
    setWarehousesEnabled,
    type WarehouseGroup,
    type WarehouseQuery,
    type WarehouseRecord
  } from '@mdm/api'
  import WarehouseDialog, { type WarehouseDialogOpenData } from './modules/warehouse-dialog.vue'
  import WarehouseGroupDialog, {
    type WarehouseGroupDialogOpenData
  } from './modules/warehouse-group-dialog.vue'
  import WarehouseGroupPanel from './modules/warehouse-group-panel.vue'

  defineOptions({ name: 'MdmWarehouseDefinition' })

  interface WarehouseDialogExpose {
    handleOpen: (data: WarehouseDialogOpenData) => Promise<void>
  }
  interface WarehouseGroupDialogExpose {
    handleOpen: (data: WarehouseGroupDialogOpenData) => Promise<void>
  }
  type TableParams = WarehouseQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const { confirmDelete } = useArtFeedback()
  const { effectiveTenantId } = storeToRefs(useTenantScopeStore())
  const tableRef = ref<ArtTableQueryExpose>()
  const warehouseDialogRef = ref<WarehouseDialogExpose>()
  const groupDialogRef = ref<WarehouseGroupDialogExpose>()
  const groups = ref<WarehouseGroup[]>([])
  const selectedGroupId = ref('')
  const groupState = reactive({ loading: true, error: '' })
  const search = reactive({
    keyword: '',
    status: undefined as 'enabled' | 'disabled' | undefined
  })
  const searchItems: SearchFormItem[] = [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '仓库编码、名称、负责人或备注' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: [
          { label: '启用', value: 'enabled' },
          { label: '禁用', value: 'disabled' }
        ]
      }
    }
  ]

  const openWarehouseDialog = (row?: WarehouseRecord, copy = false): void =>
    void warehouseDialogRef.value?.handleOpen({
      row: row ? cloneDeep(row) : undefined,
      copy,
      tenantId: row?.tenantId || effectiveTenantId.value || '',
      groups: groups.value,
      selectedGroupId: selectedGroupId.value
    })
  const openGroupDialog = (row?: WarehouseGroup): void =>
    void groupDialogRef.value?.handleOpen({
      row,
      groups: groups.value
    })
  const openChildGroupDialog = (parent?: WarehouseGroup): void =>
    void groupDialogRef.value?.handleOpen({
      parentId: parent?.id,
      groups: groups.value
    })
  const selectGroup = async (id: string): Promise<void> => {
    selectedGroupId.value = id
    await tableRef.value?.getData()
  }
  const removeGroup = async (row: WarehouseGroup): Promise<void> => {
    await confirmDelete(`确定删除仓库分组“${row.name}”吗？存在下级分组或仓库时无法删除。`)
    await deleteWarehouseGroup(row.id)
    if (selectedGroupId.value === row.id) selectedGroupId.value = ''
    await refresh()
  }
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'MdmWarehouseDefinition:Add',
      type: 'add',
      label: '新增仓库',
      buttonProps: { plain: false },
      onClick: () => openWarehouseDialog()
    },
    { permission: 'MdmWarehouseDefinition:Export', type: 'export', label: '导出' },
    {
      permission: 'MdmWarehouseDefinition:Copy',
      label: '复制',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
      onClick: ({ selectedRows }: ArtTableQueryHeaderActionContext) =>
        openWarehouseDialog(selectedRows[0] as WarehouseRecord, true)
    },
    {
      permission: 'MdmWarehouseDefinition:Enable',
      label: '启用',
      icon: 'ri:checkbox-circle-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setWarehousesEnabled(
          selectedRows.map((row) => String(row.id)),
          true
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'MdmWarehouseDefinition:Disable',
      label: '禁用',
      icon: 'ri:forbid-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setWarehousesEnabled(
          selectedRows.map((row) => String(row.id)),
          false
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'MdmWarehouseDefinition:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个仓库吗？被库存业务引用的仓库无法删除。`,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await deleteWarehouses(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ]
  const identity = (row: WarehouseRecord) => (
    <BusinessTableIdentityCell
      primary={row.warehouseName}
      secondary={row.warehouseCode}
      icon="ri:store-2-line"
    />
  )
  const columnsFactory = (): ColumnOption<WarehouseRecord>[] => [
    { type: 'selection', width: 48 },
    {
      prop: 'warehouseName',
      label: '仓库',
      minWidth: 220,
      fixed: 'left',
      formatter: identity
    },
    {
      prop: 'warehouseType',
      label: '仓库类型',
      width: 128,
      dict: { code: 'mdmWarehouseType', display: 'auto' }
    },
    {
      prop: 'organizationName',
      label: '库存组织',
      minWidth: 180,
      formatter: (row) => row.organizationName || '未配置'
    },
    {
      prop: 'businessScopes',
      label: '业务应用范围',
      minWidth: 240,
      formatter: (row) => (
        <div class="flex flex-wrap gap-1">
          {row.businessScopes.map((scope) => (
            <ArtDictDisplay dictCode="mdmWarehouseBusinessScope" value={scope} display="tag" />
          ))}
        </div>
      )
    },
    {
      prop: 'groupId',
      label: '仓库分组',
      minWidth: 150,
      formatter: (row) => row.group?.name || '未分组'
    },
    {
      prop: 'responsibleEmployeeId',
      label: '仓库负责人',
      minWidth: 180,
      formatter: (row) =>
        row.responsible ? (
          <div class="warehouse-page__person">
            <strong>{row.responsible.employeeName}</strong>
            <small>{row.responsible.employeeNo}</small>
          </div>
        ) : (
          <span class="warehouse-page__unset">未配置</span>
        )
    },
    {
      prop: 'enableZones',
      label: '启用库区',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.enableZones ? 'primary' : 'info'} effect="light">
          {row.enableZones ? '已开启' : '未开启'}
        </ElTag>
      )
    },
    {
      prop: 'enableLocations',
      label: '启用库位',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.enableLocations ? 'primary' : 'info'} effect="light">
          {row.enableLocations ? '已开启' : '未开启'}
        </ElTag>
      )
    },
    {
      prop: 'singleSkuPerBin',
      label: '一位一品',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.singleSkuPerBin ? 'success' : 'info'} effect="light">
          {row.singleSkuPerBin ? '是' : '否'}
        </ElTag>
      )
    },
    {
      prop: 'remark',
      label: '备注',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) => row.remark || '—'
    },
    {
      prop: 'status',
      label: '启用状态',
      width: 110,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.status === 'enabled' ? 'success' : 'info'} effect="light">
          {row.status === 'enabled' ? '启用' : '禁用'}
        </ElTag>
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 168,
      formatter: (row) => (row.updateTime ? dayjs(row.updateTime).format('YYYY-MM-DD HH:mm') : '—')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 156,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            permission="MdmWarehouseDefinition:Edit"
            type="edit"
            onClick={() => openWarehouseDialog(row)}
          />
          <ArtButtonTable
            permission="MdmWarehouseDefinition:Delete"
            type="delete"
            onClick={async () => {
              await confirmDelete(`确定删除仓库“${row.warehouseName}”吗？`)
              await deleteWarehouses([row.id])
              await refresh()
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchData = async (params: TableParams, options?: { signal?: AbortSignal }) => {
    try {
      groupState.loading = true
      groupState.error = ''
      const result = await fetchWarehouseWorkspace(
        { ...params, groupId: selectedGroupId.value || undefined },
        options
      )
      groups.value = result.groups
      return { records: result.data, total: result.total }
    } catch (error) {
      groupState.error = getFriendlySupabaseErrorMessage(error, '仓库分组加载失败，请重试')
      throw error
    } finally {
      groupState.loading = false
    }
  }
  const refresh = async (): Promise<void> => {
    await tableRef.value?.getData()
  }

  watch(effectiveTenantId, () => {
    selectedGroupId.value = ''
    void refresh()
  })
</script>

<style scoped lang="scss">
  .warehouse-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;

    &__workspace,
    &__table-pane {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    &__table-pane {
      display: flex;
      flex-direction: column;
    }

    :deep(.warehouse-page__person) {
      display: grid;

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.warehouse-page__unset) {
      color: var(--el-text-color-secondary);
    }
  }
</style>
