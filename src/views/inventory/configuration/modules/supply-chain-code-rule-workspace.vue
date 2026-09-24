<template>
  <ArtPermissionGuard permission="MdmSupplyChainCodeRule:View" resource-name="供应链编码规则">
    <div class="supply-code-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="INVENTORY MASTER DATA"
        title="供应链编码规则"
        description="统一维护批号、序列号与跟踪号的编码结构，让业务单据共享可审计的编号口径。"
        icon="ri:barcode-box-line"
        :tags="[
          { label: '库存主数据', type: 'primary' },
          { label: '编码预览', type: 'success' },
          { label: '属性化配置', type: 'info' }
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
          emptyText: '暂无供应链编码规则',
          emptyDescription: '点击新增规则，配置首个批号、序列号或跟踪号编码方案。'
        }"
        focusable
      />

      <SupplyChainCodeRuleDialog ref="dialogRef" @success="refresh" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import { cloneDeep } from 'lodash-es'
  import { ElTag } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
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
    deleteSupplyChainCodeRules,
    fetchSupplyChainCodeRules,
    setSupplyChainCodeRulesEnabled,
    type InventoryRuleQuery,
    type SupplyChainCodeRule
  } from '@mdm/api'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import SupplyChainCodeRuleDialog, {
    type SupplyChainCodeRuleDialogOpenData
  } from './supply-chain-code-rule-dialog.vue'

  defineOptions({ name: 'MdmSupplyChainCodeRule' })

  interface DialogExpose {
    handleOpen: (data: SupplyChainCodeRuleDialogOpenData) => Promise<void>
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
      props: { clearable: true, placeholder: '规则编码、名称或编码示例' }
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
          { label: '停用', value: 'disabled' }
        ]
      }
    }
  ]
  const openDialog = (row?: SupplyChainCodeRule, copy = false): void =>
    void dialogRef.value?.handleOpen({ row: row ? cloneDeep(row) : undefined, copy })
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      permission: 'MdmSupplyChainCodeRule:Add',
      type: 'add',
      label: '新增规则',
      onClick: () => openDialog()
    },
    { permission: 'MdmSupplyChainCodeRule:Export', type: 'export', label: '导出' },
    {
      permission: 'MdmSupplyChainCodeRule:Copy',
      label: '复制',
      icon: 'ri:file-copy-line',
      selectionRequired: true,
      disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
      onClick: ({ selectedRows }: ArtTableQueryHeaderActionContext) =>
        openDialog(selectedRows[0] as SupplyChainCodeRule, true)
    },
    {
      permission: 'MdmSupplyChainCodeRule:Enable',
      label: '启用',
      icon: 'ri:checkbox-circle-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setSupplyChainCodeRulesEnabled(
          selectedRows.map((row) => String(row.id)),
          true
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'MdmSupplyChainCodeRule:Disable',
      label: '停用',
      icon: 'ri:forbid-line',
      selectionRequired: true,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await setSupplyChainCodeRulesEnabled(
          selectedRows.map((row) => String(row.id)),
          false
        )
        await api.refreshUpdate()
      }
    },
    {
      permission: 'MdmSupplyChainCodeRule:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 个供应链编码规则吗？`,
      onClick: async ({ selectedRows, api }: ArtTableQueryHeaderActionContext) => {
        await deleteSupplyChainCodeRules(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ]
  const identity = (row: SupplyChainCodeRule) => (
    <div class="supply-code-page__identity">
      <span aria-hidden="true">
        <ArtSvgIcon icon="ri:barcode-line" />
      </span>
      <span>
        <strong title={row.ruleName}>{row.ruleName}</strong>
        <small>{row.ruleCode}</small>
      </span>
    </div>
  )
  const booleanTag = (value: boolean) => (
    <ElTag type={value ? 'success' : 'info'} effect="light" size="small">
      {value ? '适用' : '不适用'}
    </ElTag>
  )
  const columnsFactory = (): ColumnOption<SupplyChainCodeRule>[] => [
    { type: 'selection', width: 48 },
    { prop: 'ruleName', label: '编码规则', minWidth: 210, fixed: 'left', formatter: identity },
    {
      prop: 'exampleCode',
      label: '编码示例',
      minWidth: 200,
      formatter: (row) => <code class="supply-code-page__example">{row.exampleCode || '—'}</code>
    },
    {
      prop: 'segments',
      label: '编码属性',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.segments.map((item) => item.attribute?.attributeName || item.attributeCode).join(' + ')
    },
    {
      prop: 'applyBatch',
      label: '适用批号',
      width: 104,
      align: 'center',
      formatter: (row) => booleanTag(row.applyBatch)
    },
    {
      prop: 'applySerial',
      label: '适用序列号',
      width: 116,
      align: 'center',
      formatter: (row) => booleanTag(row.applySerial)
    },
    {
      prop: 'applyTracking',
      label: '适用跟踪号',
      width: 116,
      align: 'center',
      formatter: (row) => booleanTag(row.applyTracking)
    },
    {
      prop: 'perMaterial',
      label: '每物料单独编码',
      width: 132,
      align: 'center',
      formatter: (row) => booleanTag(row.perMaterial)
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
            permission="MdmSupplyChainCodeRule:Edit"
            type="edit"
            onClick={() => openDialog(row)}
          />
          <ArtButtonTable
            permission="MdmSupplyChainCodeRule:Delete"
            type="delete"
            onClick={async () => {
              await confirmDelete(`确定删除供应链编码规则“${row.ruleName}”吗？`)
              await deleteSupplyChainCodeRules([row.id])
              await refresh()
            }}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchData = async (params: TableParams, options?: { signal?: AbortSignal }) => {
    const result = await fetchSupplyChainCodeRules(params, options)
    return { records: result.data, total: result.total }
  }
  const refresh = async (): Promise<void> => {
    await tableRef.value?.getData()
  }

  watch(effectiveTenantId, () => void refresh())
</script>

<style scoped lang="scss">
  .supply-code-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    min-height: 0;

    &__identity {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-width: 0;

      > span:first-child {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 8%, var(--default-box-color));
        border-radius: var(--el-border-radius-base);
      }

      > span:last-child,
      strong,
      small {
        min-width: 0;
      }

      > span:last-child {
        display: grid;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.supply-code-page__example) {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      color: var(--theme-color);
    }
  }
</style>
