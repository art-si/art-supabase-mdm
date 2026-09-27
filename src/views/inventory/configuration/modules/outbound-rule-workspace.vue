<template>
  <ArtPermissionGuard permission="MdmOutboundRule:View" resource-name="出库规则配置">
    <div class="outbound-rule-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="出库规则配置"
        description="按字段来源与优先级编排出库顺序，为先进先出、后进先出和临期优先提供统一策略。"
        icon="ri:truck-line"
        :tags="[
          { label: '库存主数据', type: 'primary' },
          { label: '多字段排序', type: 'success' },
          { label: '优先级治理', type: 'info' }
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
        header-actions-placement="workspace"
        :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无出库规则',
          emptyDescription: '点击新增规则，建立首个库存出库排序策略。'
        }"
        focusable
      />

      <OutboundRuleDialog ref="dialogRef" @success="refresh" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import dayjs from 'dayjs'
  import { cloneDeep } from 'lodash-es'
  import { ElTag } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    deleteOutboundRules,
    fetchOutboundRules,
    setOutboundRulesEnabled,
    type InventoryRuleQuery,
    type OutboundRule,
    type OutboundRuleSort
  } from '@mdm/api'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import OutboundRuleDialog, { type OutboundRuleDialogOpenData } from './outbound-rule-dialog.vue'

  const commonEnabledStatusOptions = useDictionaryOptions('commonEnabledStatus')

  defineOptions({ name: 'MdmOutboundRule' })

  interface DialogExpose {
    handleOpen: (data: OutboundRuleDialogOpenData) => Promise<void>
  }
  type TableParams = InventoryRuleQuery & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const { confirmDelete } = useArtFeedback()
  const { effectiveTenantId } = storeToRefs(useTenantScopeStore())
  const search = reactive({
    keyword: '',
    status: undefined as 'enabled' | 'disabled' | undefined
  })
  const searchItems: SearchFormItem[] = [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '规则编码、名称或说明' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: commonEnabledStatusOptions
      }
    }
  ]
  const openDialog = (row?: OutboundRule, copy = false): void =>
    void dialogRef.value?.handleOpen({ row: row ? cloneDeep(row) : undefined, copy })
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'MdmOutboundRule:Add',
      type: 'add',
      label: '新增规则',
      buttonProps: { plain: false },
      onClick: () => openDialog()
    },
    { permission: 'MdmOutboundRule:Export', type: 'export', label: '导出' },
    {
      permission: 'MdmOutboundRule:Copy',
      label: '复制',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
      onClick: ({ selectedRows }: ArtTableQueryHeaderActionContext) =>
        openDialog(selectedRows[0] as OutboundRule, true)
    },
    {
      permission: 'MdmOutboundRule:Enable',
      label: '启用',
      icon: 'ri:checkbox-circle-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setOutboundRulesEnabled(
          selectedRows.map((row) => String(row.id)),
          true
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'MdmOutboundRule:Disable',
      label: '停用',
      icon: 'ri:forbid-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setOutboundRulesEnabled(
          selectedRows.map((row) => String(row.id)),
          false
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'MdmOutboundRule:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个出库规则吗？`,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await deleteOutboundRules(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ]
  const identity = (row: OutboundRule) => (
    <BusinessTableIdentityCell
      primary={row.ruleName}
      secondary={row.ruleCode}
      icon="ri:route-line"
    />
  )
  const stacked = (sorts: OutboundRuleSort[], value: (row: OutboundRuleSort) => string) => (
    <div class="outbound-rule-page__stack">
      {sorts.map((row, index) => (
        <span key={`${row.fieldCode}-${index}`} title={value(row)}>
          {value(row) || '—'}
        </span>
      ))}
    </div>
  )
  const columnsFactory = (): ColumnOption<OutboundRule>[] => [
    { type: 'selection', width: 48 },
    { prop: 'ruleName', label: '出库规则', minWidth: 230, fixed: 'left', formatter: identity },
    {
      prop: 'fieldSource',
      label: '字段来源',
      minWidth: 180,
      formatter: (row) => stacked(row.sorts, (item) => item.field?.sourceName || '')
    },
    {
      prop: 'fieldName',
      label: '排序字段名称',
      minWidth: 170,
      formatter: (row) => stacked(row.sorts, (item) => item.field?.fieldName || '')
    },
    {
      prop: 'fieldKey',
      label: '排序字段标识',
      minWidth: 150,
      formatter: (row) => stacked(row.sorts, (item) => item.field?.fieldKey || '')
    },
    {
      prop: 'direction',
      label: '排序方式',
      width: 104,
      formatter: (row) => stacked(row.sorts, (item) => (item.direction === 'asc' ? '升序' : '降序'))
    },
    {
      prop: 'status',
      label: '启用状态',
      width: 100,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.status === 'enabled' ? 'success' : 'info'} effect="light">
          {row.status === 'enabled' ? '启用' : '停用'}
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
            permission="MdmOutboundRule:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="MdmOutboundRule:Delete"
            type="delete"
            onClick={async () => {
              await confirmDelete(`确定删除出库规则“${row.ruleName}”吗？`)
              await deleteOutboundRules([row.id])
              await refresh()
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchData = async (params: TableParams, options?: { signal?: AbortSignal }) => {
    const result = await fetchOutboundRules(params, options)
    return { records: result.data, total: result.total }
  }
  const refresh = async (): Promise<void> => {
    await tableRef.value?.getData()
  }

  watch(effectiveTenantId, () => void refresh())
</script>

<style scoped lang="scss">
  .outbound-rule-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    min-height: 0;

    :deep(.outbound-rule-page__stack) {
      display: grid;

      span {
        min-width: 0;
        padding: 4px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        & + span {
          border-top: 1px solid var(--el-border-color-lighter);
        }
      }
    }
  }
</style>
