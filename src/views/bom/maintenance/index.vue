<template>
  <ArtPermissionGuard permission="MdmBomMaintenance:View" resource-name="BOM 维护">
    <div class="bom-maintenance-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="ENGINEERING MASTER"
        title="BOM 维护"
        description="以版本和用途治理产品结构，在设计、审核、生效与变更之间保留清晰的工程边界。"
        icon="ri:git-merge-line"
        :tags="[
          { label: '版本受控', type: 'primary' },
          { label: '循环校验', type: 'success' },
          { label: '租户隔离', type: 'info' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>
      <div class="bom-maintenance-page__workspace">
        <BomGroupPanel
          :groups="groups"
          :selected-id="selectedGroupId"
          :loading="groupLoading"
          :error="groupError"
          @select="selectGroup"
          @refresh="loadGroups"
          @add="openGroupDialog"
          @edit="editGroup"
          @remove="removeGroup"
        />
        <ArtTableQuery
          ref="tableRef"
          v-model="search"
          :api-fn="fetchData"
          :search-items="searchItems"
          :columns-factory="columnsFactory"
          :header-actions="headerActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 6, labelWidth: 82, showExpand: false, isExpand: true }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: '暂无 BOM',
            emptyDescription: '从父项物料开始创建第一版受控 BOM。'
          }"
          :on-success="handleTableSuccess"
          focusable
        />
      </div>
      <BomDialog ref="dialogRef" @success="refresh" />
      <BomGroupDialog ref="groupDialogRef" @success="handleGroupSaved" />
      <BomDetailDialog ref="detailDialogRef" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import type { ColumnOption } from '@/types'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import { exportExcel } from '@/utils/file'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import TreeUtils from '@/utils/tree'
  import { useUserStore } from '@/store/modules/user'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import {
    deleteBom,
    deleteBomGroup,
    fetchBomGroups,
    fetchBoms,
    fetchMaterialReferenceOptions,
    transitionBom,
    type BomGroup,
    type BomQuery,
    type BomRecord,
    type BomStatus,
    type UnitOfMeasure
  } from '@mdm/api'
  import BomDialog, { type BomDialogOpenData } from './modules/bom-dialog.vue'
  import BomDetailDialog from './modules/bom-detail-dialog.vue'
  import BomGroupDialog from './modules/bom-group-dialog.vue'
  import BomGroupPanel from './modules/bom-group-panel.vue'
  import { formatBomMaterialDescription } from '../modules/material-description'

  defineOptions({ name: 'MdmBomMaintenance' })
  const { confirmAction } = useArtFeedback()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const { effectiveTenantId, tenantOptions } = storeToRefs(useTenantScopeStore())
  const tenantId = computed(() => effectiveTenantId.value ?? '')
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<InstanceType<typeof BomDialog>>()
  const groupDialogRef = ref<InstanceType<typeof BomGroupDialog>>()
  const detailDialogRef = ref<InstanceType<typeof BomDetailDialog>>()
  const units = ref<UnitOfMeasure[]>([])
  const groups = ref<BomGroup[]>([])
  const groupLoading = ref(false)
  const groupError = ref<Error | null>(null)
  const selectedGroupId = ref('')
  const groupTreeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId' })
  const groupTree = computed(() => groupTreeUtils.listToTree(groups.value) as BomGroup[])
  const overview = reactive({ total: 0, rows: [] as BomRecord[] })
  const search = reactive({
    keyword: '',
    purpose: undefined as BomQuery['purpose'],
    status: undefined as BomQuery['status']
  })
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: 'BOM 总数',
      value: overview.total,
      description: '当前查询范围',
      icon: 'ri:git-merge-line'
    },
    {
      label: '本页已生效',
      value: overview.rows.filter((row) => row.status === 'effective').length,
      description: '可供生产引用',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '本页待审核',
      value: overview.rows.filter((row) => row.status === 'review').length,
      description: '等待工程审核',
      icon: 'ri:time-line',
      tone: 'warning'
    },
    {
      label: '本页组件',
      value: overview.rows.reduce((total, row) => total + row.items.length, 0),
      description: '结构明细总量',
      icon: 'ri:node-tree',
      tone: 'info'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'keyword',
      label: '关键字',
      type: 'input',
      props: { clearable: true, placeholder: 'BOM 编码、版本或说明' }
    },
    {
      key: 'purpose',
      label: 'BOM 用途',
      type: 'select',
      props: { clearable: true, options: getDictMap.value.mdmBomPurpose ?? [] }
    },
    {
      key: 'status',
      label: '生命周期',
      type: 'select',
      props: { clearable: true, options: getDictMap.value.mdmBomStatus ?? [] }
    }
  ])
  const ensureOptions = async () => {
    if (!units.value.length)
      units.value = await fetchMaterialReferenceOptions<UnitOfMeasure>(
        'unit-of-measure',
        tenantId.value
      )
  }
  const loadGroups = async () => {
    groupLoading.value = true
    groupError.value = null
    try {
      groups.value = await fetchBomGroups(tenantId.value)
    } catch (error) {
      groups.value = []
      groupError.value = error instanceof Error ? error : new Error('BOM 分组加载失败')
    } finally {
      groupLoading.value = false
    }
  }
  const groupDialogData = (options: { row?: BomGroup; parent?: BomGroup } = {}) => ({
    tenantId: options.row?.tenantId || options.parent?.tenantId || tenantId.value,
    tenantOptions: tenantOptions.value.map((tenant) => ({
      label: tenant.tenantName || tenant.tenantCode,
      value: tenant.id
    })),
    groups: groups.value,
    ...options
  })
  const openGroupDialog = async (parent?: BomGroup) =>
    groupDialogRef.value?.handleOpen(groupDialogData({ parent }))
  const editGroup = async (row: BomGroup) =>
    groupDialogRef.value?.handleOpen(groupDialogData({ row }))
  const handleGroupSaved = async (id: string) => {
    await loadGroups()
    if (id) selectedGroupId.value = id
    refresh()
  }
  const removeGroup = async (row: BomGroup) => {
    await confirmAction(`确定删除 BOM 分组“${row.name}”吗？`, '删除 BOM 分组', {
      type: 'warning'
    })
    await deleteBomGroup(row.id)
    if (selectedGroupId.value === row.id) selectedGroupId.value = ''
    await loadGroups()
    refresh()
  }
  const descendantIds = (id: string) =>
    groupTreeUtils.getDescendants(groupTree.value, id, true).map((group) => group.id)
  const selectGroup = (group?: BomGroup) => {
    selectedGroupId.value = group?.id || ''
    refresh()
  }
  const openDialog = async (row?: BomRecord, options?: { copy?: boolean }) => {
    await ensureOptions()
    const data: BomDialogOpenData = {
      row,
      tenantId: row?.tenantId || tenantId.value,
      tenantOptions: tenantOptions.value.map((tenant) => ({
        label: tenant.tenantName || tenant.tenantCode,
        value: tenant.id
      })),
      units: units.value,
      groups: groups.value,
      ...options
    }
    await dialogRef.value?.handleOpen(data)
  }
  const openDetail = async (row: BomRecord): Promise<void> => {
    await detailDialogRef.value?.handleOpen(row)
  }
  const fetchData = async (params: BomQuery, options?: { signal?: AbortSignal }) => {
    await ensureOptions()
    return fetchBoms(
      {
        ...params,
        tenantId: tenantId.value,
        groupIds: selectedGroupId.value ? descendantIds(selectedGroupId.value) : undefined
      },
      options
    )
  }
  const handleTableSuccess: ArtTableQueryProps['onSuccess'] = (rows, response) => {
    overview.rows = rows as BomRecord[]
    overview.total = Number(response.total ?? rows.length)
  }
  const refresh = () => tableRef.value?.refreshData()
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      type: 'add',
      label: '新增 BOM',
      permission: 'MdmBomMaintenance:Add',
      onClick: () => void openDialog()
    },
    {
      type: 'export',
      label: '导出',
      permission: 'MdmBomMaintenance:Export',
      onClick: () => void exportRows()
    }
  ]
  const identity = (row: BomRecord) => (
    <div class="bom-maintenance-page__identity">
      <span aria-hidden="true">
        <ArtSvgIcon icon="ri:git-merge-line" />
      </span>
      <span>
        <strong title={row.material?.materialName || ''}>
          {formatBomMaterialDescription(row.material) || '父项待关联'}
        </strong>
        <small>
          {[row.material?.materialCode, row.material?.specificationModel]
            .filter(Boolean)
            .join(' · ') || '—'}
        </small>
      </span>
    </div>
  )
  const moreActions = (row: BomRecord): ButtonMoreItem[] => [
    {
      key: 'copy',
      label: '复制为新版本',
      icon: 'ri:file-copy-line',
      auth: 'MdmBomMaintenance:Copy'
    },
    {
      key: 'submit',
      label: '提交审核',
      icon: 'ri:send-plane-line',
      auth: 'MdmBomMaintenance:Submit',
      disabled: !['design', 'changing'].includes(row.status)
    },
    {
      key: 'approve',
      label: '审核生效',
      icon: 'ri:verified-badge-line',
      auth: 'MdmBomMaintenance:Approve',
      disabled: row.status !== 'review'
    },
    {
      key: 'change',
      label: '发起变更',
      icon: 'ri:edit-circle-line',
      auth: 'MdmBomMaintenance:Edit',
      disabled: row.status !== 'effective'
    },
    {
      key: 'archive',
      label: '归档',
      icon: 'ri:archive-line',
      auth: 'MdmBomMaintenance:Archive',
      disabled: !['effective', 'changing'].includes(row.status)
    },
    {
      key: 'void',
      label: '作废',
      icon: 'ri:close-circle-line',
      color: 'var(--el-color-warning)',
      auth: 'MdmBomMaintenance:Archive',
      disabled: ['archived', 'void'].includes(row.status)
    },
    {
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-6-line',
      color: 'var(--el-color-danger)',
      auth: 'MdmBomMaintenance:Delete',
      disabled: row.status !== 'design'
    }
  ]
  const handleMore = async (item: ButtonMoreItem, row: BomRecord) => {
    if (item.key === 'copy') return void openDialog(row, { copy: true })
    if (item.key === 'delete') {
      await confirmAction(`确定删除 BOM“${row.bomCode}”及其全部组件吗？`, '删除 BOM', {
        type: 'warning'
      })
      await deleteBom(row.id)
      return void refresh()
    }
    const targets: Record<string, BomStatus> = {
      submit: 'review',
      approve: 'effective',
      change: 'changing',
      archive: 'archived',
      void: 'void'
    }
    const target = targets[String(item.key)]
    if (!target) return
    await confirmAction(
      `确定将 BOM“${row.bomCode}”更新为“${userStore.getDictLabelByValue('mdmBomStatus', target) || target}”吗？`,
      '更新 BOM 生命周期',
      { type: 'warning' }
    )
    await transitionBom(row.id, target)
    await refresh()
  }
  const columnsFactory = (): ColumnOption<BomRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 72, fixed: 'left' },
    {
      prop: 'materialId',
      label: '父项物料',
      minWidth: 290,
      fixed: 'left',
      formatter: identity,
      link: { permission: 'MdmBomMaintenance:View', onClick: openDetail }
    },
    {
      prop: 'projectId',
      label: '项目归属',
      minWidth: 190,
      formatter: (row) =>
        row.project ? `${row.project.projectName} · ${row.project.projectCode}` : '通用 BOM'
    },
    {
      prop: 'groupId',
      label: 'BOM 分组',
      minWidth: 130,
      formatter: (row) => row.group?.name || '未分组'
    },
    {
      prop: 'bomCode',
      label: 'BOM 身份',
      minWidth: 170,
      formatter: (row) => (
        <div class="bom-maintenance-page__code">
          <strong>{row.bomCode}</strong>
          <small>
            {row.version} · <ArtDictDisplay dictCode="mdmBomPurpose" value={row.purpose} />
          </small>
        </div>
      )
    },
    {
      prop: 'items',
      label: '组件数',
      width: 92,
      align: 'center',
      formatter: (row) => `${row.items.length} 项`
    },
    {
      prop: 'status',
      label: '生命周期',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <div class="flex flex-col items-center gap-1">
          <ArtDictDisplay dictCode="mdmBomStatus" value={row.status} display="tag" />
          {row.sourceQuotationId && row.status === 'design' ? (
            <small class="text-[var(--art-gray-600)]">工程报价待复核</small>
          ) : null}
        </div>
      )
    },
    {
      prop: 'effectiveFrom',
      label: '有效期',
      minWidth: 180,
      formatter: (row) => [row.effectiveFrom || '未设起始', row.effectiveTo || '长期'].join(' ～ ')
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => (row.updateTime ? dayjs(row.updateTime).format('YYYY-MM-DD HH:mm') : '—')
    },
    {
      prop: 'operation',
      label: '操作',
      width: 176,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="view"
            permission="MdmBomMaintenance:View"
            onClick={() => void openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission="MdmBomMaintenance:Edit"
            disabled={!['design', 'changing'].includes(row.status)}
            onClick={() => void openDialog(row)}
          />
          <ArtButtonMore
            list={() => moreActions(row)}
            onClick={(item) => void handleMore(item, row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const exportRows = async () => {
    const result = await fetchBoms({ ...search, tenantId: tenantId.value, current: 1, size: 10000 })
    await exportExcel({
      data: result.data.map((row) => ({
        code: row.bomCode,
        materialCode: row.material?.materialCode,
        materialName: row.material?.materialName,
        version: row.version,
        purpose: userStore.getDictLabelByValue('mdmBomPurpose', row.purpose) || row.purpose,
        status: userStore.getDictLabelByValue('mdmBomStatus', row.status) || row.status,
        itemCount: row.items.length
      })),
      columns: [
        { key: 'code', title: 'BOM 编码' },
        { key: 'materialCode', title: '父项编码' },
        { key: 'materialName', title: '父项名称' },
        { key: 'version', title: '版本' },
        { key: 'purpose', title: '用途' },
        { key: 'status', title: '状态' },
        { key: 'itemCount', title: '组件数' }
      ],
      filename: 'BOM维护'
    })
  }

  void Promise.all([
    userStore.ensureDictLoaded('mdmBomPurpose'),
    userStore.ensureDictLoaded('mdmBomStatus')
  ])
  watch(tenantId, () => void loadGroups(), { immediate: true })
</script>

<style scoped lang="scss">
  .bom-maintenance-page {
    gap: 12px;
    min-width: 0;
  }

  .bom-maintenance-page__workspace {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(240px, 286px) minmax(0, 1fr);
    gap: 12px;
    min-height: 0;
  }

  .bom-maintenance-page__workspace > :deep(*) {
    min-height: 0;
  }

  :deep(.bom-maintenance-page__identity) {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  :deep(.bom-maintenance-page__identity > span:first-child) {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
    border-radius: 10px;
  }

  :deep(.bom-maintenance-page__identity > span:last-child),
  :deep(.bom-maintenance-page__identity strong),
  :deep(.bom-maintenance-page__identity small),
  :deep(.bom-maintenance-page__code strong),
  :deep(.bom-maintenance-page__code small) {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.bom-maintenance-page__identity small),
  :deep(.bom-maintenance-page__code small) {
    margin-top: 2px;
    font-family: var(--art-font-family-mono, Consolas, monospace);
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  :deep(.bom-maintenance-page__code strong) {
    font-family: var(--art-font-family-mono, Consolas, monospace);
    color: var(--theme-color);
  }

  @media (width <= 980px) {
    .bom-maintenance-page__workspace {
      grid-template-columns: 1fr;
    }

    :deep(.bom-group-panel) {
      max-height: 280px;
    }
  }
</style>
