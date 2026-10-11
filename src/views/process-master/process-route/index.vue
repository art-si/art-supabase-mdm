<template>
  <div class="process-route-page business-workspace-page art-full-height"
    ><ProductionWorkspaceHeader
      title="工艺路线"
      description="维护产品的工艺路径和工序明细，关联工作中心与标准作业模板。"
      icon="ri:route-line"
      capability="工艺路径治理"
      :metrics="workspaceMetrics"
      ><template #actions
        ><BusinessTableWorkspaceActions :table="tableRef" /></template></ProductionWorkspaceHeader
    ><div class="process-route-page__workspace">
      <ArtWorkspaceSplitter
        primary-size="300px"
        primary-min="256px"
        primary-max="400px"
        :breakpoint="900"
        stacked-primary-size="auto"
      >
        <template #primary>
          <MasterGroupPanel
            title="路线分组"
            :groups="groupState.rows"
            :selected-id="groupState.selectedId"
            :loading="groupState.loading"
            :error="groupState.error"
            manage-permission="MdmProcessRoute:ManageGroup"
            :show-tree-toggle="false"
            @select="selectGroup"
            @refresh="loadGroups"
            @add="openGroupAdd"
            @edit="openGroupEdit"
            @remove="removeGroup"
          />
        </template>
        <div class="process-route-page__main">
          <ArtTableQuery
            ref="tableRef"
            :model-value="search"
            @update:model-value="replaceReactiveModel(search, $event)"
            :api-fn="fetchRows"
            :columns-factory="columns"
            :header-actions="actions"
            header-actions-placement="workspace"
            :search-bar-props="{ span: 8, labelWidth: 82, showExpand: false }"
            :on-success="handleTableSuccess"
            :search-items="[
              {
                key: 'keyword',
                label: '路线信息',
                type: 'input',
                props: { clearable: true, placeholder: '编码 / 名称 / 版本 / 路径' }
              },
              {
                key: 'enabled',
                label: '启用状态',
                type: 'select',
                props: {
                  clearable: true,
                  options: booleanOptions
                }
              }
            ]"
            :enable-cache="false"
            focusable
            focus-scope-selector=".process-route-page__workspace"
            :table-props="{
              rowKey: 'id',
              tableLayout: 'fixed',
              emptyText: '暂无工艺路线',
              emptyDescription: '先创建产品路线，再维护工序序列与工艺配置。'
            }"
          />
        </div>
      </ArtWorkspaceSplitter>
    </div>
    <RouteDialog ref="routeDialog" @success="refresh" />
    <StepsDialog ref="stepsDialog" />
    <GroupDialog ref="groupDialog" @success="handleGroupSaved" />
    <MasterDataDeleteGuard ref="groupDeleteGuardRef" />
    <MasterDataDeleteGuard ref="routeDeleteGuardRef" />
  </div>
</template>
<script setup lang="tsx">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { computed, ref, reactive } from 'vue'
  import dayjs from 'dayjs'
  import { ElTag } from 'element-plus'
  import { uniq } from 'lodash-es'
  import type { ColumnOption } from '@/types'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import type { BusinessWorkspaceMetric } from '@/components/business/business-workspace-header/index.vue'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import { useAuth } from '@/hooks/core/useAuth'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { loadAllLinePages } from '@/utils/business/document-detail-list'
  import { createTenantScopeReadGuard } from '@/utils/tenant-scope-context'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { exportExcel } from '@/utils/file'
  import { formatWithDayjs } from '@/utils/time'
  import TreeUtils from '@/utils/tree'
  import {
    fetchProcessRoutes,
    fetchProcessRouteById,
    copyProcessRoute,
    deleteProcessRoute,
    fetchProcessRouteOwnedDeleteDependencies,
    importProcessRoutes,
    fetchMasterGroups,
    deleteMasterGroup,
    type MasterGroup,
    type ProcessRoute,
    type ProcessRouteInput,
    type WorkspaceQuery
  } from '@mdm/api'
  import MasterGroupPanel from '@/components/business/master-group-panel/index.vue'
  import type { GroupDialogOpenData } from '../../components/operational-master/modules/group-dialog.vue'
  import GroupDialog from '../../components/operational-master/modules/group-dialog.vue'
  import RouteDialog from './modules/route-dialog.vue'
  import StepsDialog from './modules/steps-dialog.vue'
  import ProductionWorkspaceHeader from '../../production/modules/production-workspace-header.vue'
  defineOptions({ name: 'MdmProcessRoute' })
  const declaredPermissions = [
    'MdmProcessRoute:View',
    'MdmProcessRoute:Add',
    'MdmProcessRoute:Copy',
    'MdmProcessRoute:Edit',
    'MdmProcessRoute:Delete',
    'MdmProcessRoute:Import',
    'MdmProcessRoute:Export',
    'MdmProcessRoute:ManageGroup'
  ] as const
  void declaredPermissions
  const { promptText } = useArtFeedback()
  const { hasAuth } = useAuth()
  const { deleteGuardRef: groupDeleteGuardRef, deleteRecords: deleteGroups } = useRecordDeleteGuard(
    'mdm_master_group',
    '工艺路线分组',
    {
      mdm_master_group: {
        label: '下级工艺路线分组',
        routeName: 'MdmProcessRoute',
        actionLabel: '查看分组',
        canNavigate: () => hasAuth('MdmProcessRoute:View')
      },
      mdm_process_route: {
        label: '工艺路线',
        routeName: 'MdmProcessRoute',
        actionLabel: '查看路线',
        canNavigate: () => hasAuth('MdmProcessRoute:View')
      }
    }
  )
  const {
    deleteGuardRef: routeDeleteGuardRef,
    deleteRecord: deleteRoute,
    deleteBusy: routeDeleteBusy
  } = useRecordDeleteGuard(
    'mdm_process_route',
    '工艺路线',
    {
      mdm_process_route_sequence: {
        routeName: 'MdmProcessRoute',
        actionLabel: '查看所属路线',
        canNavigate: () => hasAuth('MdmProcessRoute:View'),
        routeQuery: (record) => ({ routeId: record.resourceId })
      },
      mdm_process_route_step: {
        routeName: 'MdmProcessRoute',
        actionLabel: '查看所属路线',
        canNavigate: () => hasAuth('MdmProcessRoute:View'),
        routeQuery: (record) => ({ routeId: record.resourceId })
      }
    },
    (context) => fetchProcessRouteOwnedDeleteDependencies(context.ids)
  )
  const tenantScopeStore = useTenantScopeStore()
  const userStore = useUserStore()
  const { effectiveTenantId, tenantOptions } = storeToRefs(tenantScopeStore)
  interface RouteDialogExpose {
    handleOpen: (row?: ProcessRoute, tenantId?: string) => Promise<void>
  }
  interface StepsDialogExpose {
    handleOpen: (row: ProcessRoute, viewOnly?: boolean) => Promise<void>
  }
  const tableRef = ref<ArtTableQueryExpose>()
  const routeDialog = ref<RouteDialogExpose>()
  const stepsDialog = ref<StepsDialogExpose>()
  const groupDialog = ref<{ handleOpen: (data: GroupDialogOpenData) => Promise<void> }>()
  const search = reactive({ keyword: '', enabled: undefined as boolean | undefined })
  const overview = reactive({ total: 0, rows: [] as ProcessRoute[] })
  const groupState = reactive({
    rows: [] as MasterGroup[],
    selectedId: '',
    loading: false,
    error: ''
  })
  const groupTreeUtils = new TreeUtils({ parentKey: 'parentId' })
  const selectedGroupIds = computed(() =>
    groupState.selectedId
      ? groupTreeUtils
          .getDescendants(groupTreeUtils.listToTree(groupState.rows), groupState.selectedId, true)
          .map((group) => String(group.id))
      : undefined
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '路线总数',
      value: overview.total,
      description: '当前查询范围内的产品路线',
      icon: 'ri:route-line'
    },
    {
      label: '本页产品',
      value: uniq(overview.rows.map((row) => row.materialId)).length,
      description: '当前页已配置路线的产品',
      icon: 'ri:box-3-line',
      tone: 'success'
    },
    {
      label: '近 30 日更新',
      value: overview.rows.filter((row) =>
        dayjs(row.updateTime).isAfter(dayjs().subtract(30, 'day'))
      ).length,
      description: '当前页近期调整记录',
      icon: 'ri:history-line'
    }
  ])
  const booleanOptions = useDictionaryOptions(
    'commonBoolean',
    (value) => value === 'true' || value === '1'
  )
  async function openRouteDialog(row?: ProcessRoute, tenantId?: string): Promise<void> {
    await routeDialog.value?.handleOpen(row, tenantId)
  }
  async function openStepsDialog(row: ProcessRoute, viewOnly = false): Promise<void> {
    await stepsDialog.value?.handleOpen(row, viewOnly)
  }
  const fetchRows = (p: WorkspaceQuery, o?: { signal?: AbortSignal }) =>
    fetchProcessRoutes(
      {
        ...p,
        tenantId: effectiveTenantId.value || '',
        groupId: groupState.selectedId || undefined,
        groupIds: selectedGroupIds.value
      },
      o
    )
  const refresh = () => tableRef.value?.refreshData()
  const handleTableSuccess: ArtTableQueryProps['onSuccess'] = (rows, response) => {
    overview.rows = rows as ProcessRoute[]
    overview.total = Number(response.total ?? rows.length)
  }
  const columns = (): ColumnOption<ProcessRoute>[] => [
    { type: 'globalIndex', label: '序号', width: 72 },
    {
      prop: 'code',
      label: '路线编码',
      width: 128,
      fixed: 'left',
      link: { permission: 'MdmProcessRoute:View', onClick: (row) => openStepsDialog(row, true) }
    },
    {
      prop: 'material',
      label: '产品主数据',
      minWidth: 280,
      fixed: 'left',
      formatter: (r) => (
        <BusinessTableIdentityCell
          primary={r.material?.materialName || '产品待关联'}
          secondary={
            [r.material?.materialCode, r.material?.specificationModel]
              .filter(Boolean)
              .join(' · ') || '—'
          }
          icon="ri:box-3-line"
        />
      )
    },
    {
      prop: 'name',
      label: '路线名称',
      minWidth: 210,
      formatter: (row) => (
        <div class="process-route-page__route-name">
          <strong title={row.name}>{row.name || '未命名路线'}</strong>
          <small>{row.path || '尚未填写工艺路径'}</small>
        </div>
      )
    },
    {
      prop: 'version',
      label: '工艺版本',
      width: 110,
      align: 'center',
      formatter: (row) => <span class="process-route-page__version">{row.version || '—'}</span>
    },
    {
      prop: 'group',
      label: '路线分组',
      minWidth: 140,
      formatter: (row) => row.group?.name || '未分组'
    },
    {
      prop: 'routeType',
      label: '类型',
      width: 100,
      formatter: (row) =>
        userStore.getDictItemByValue('mdmProcessRouteType', row.routeType)?.label || row.routeType
    },
    {
      prop: 'allocationMode',
      label: '分配方式',
      width: 110,
      formatter: (row) =>
        userStore.getDictItemByValue('mdmProcessRouteAllocationMode', row.allocationMode)?.label ||
        row.allocationMode
    },
    {
      prop: 'department',
      label: '生产车间',
      minWidth: 130,
      formatter: (row) => row.department?.name || '未指定'
    },
    {
      prop: 'isDefault',
      label: '默认',
      width: 80,
      align: 'center',
      formatter: (row) =>
        row.isDefault ? (
          <ElTag type="success" effect="plain" size="small">
            默认
          </ElTag>
        ) : (
          <span class="process-route-page__muted">—</span>
        )
    },
    {
      prop: 'batchFrom',
      label: '批量从',
      width: 100,
      align: 'right',
      formatter: (row) => row.batchFrom ?? '—'
    },
    { prop: 'batchTo', label: '批量至', width: 120, align: 'right' },
    {
      prop: 'productionUnit',
      label: '生产单位',
      width: 110,
      formatter: (row) => row.productionUnit?.unitName || '多单位'
    },
    { prop: 'effectiveDate', label: '生效日期', width: 116 },
    { prop: 'expiryDate', label: '失效日期', width: 116 },
    {
      prop: 'source',
      label: '来源',
      width: 100,
      formatter: (row) =>
        userStore.getDictItemByValue('mdmProcessRouteSource', row.source)?.label || row.source
    },
    {
      prop: 'enabled',
      label: '状态',
      width: 88,
      align: 'center',
      formatter: (row) => (
        <ElTag type={row.enabled ? 'success' : 'info'} effect="plain" size="small">
          {row.enabled ? '启用' : '停用'}
        </ElTag>
      )
    },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => formatWithDayjs(row.updateTime) || '—'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 164,
      fixed: 'right',
      formatter: (r) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="view"
            permission="MdmProcessRoute:View"
            onClick={() => void openStepsDialog(r, true)}
          />
          <ArtButtonTable
            type="edit"
            permission="MdmProcessRoute:Edit"
            onClick={() => void openRouteDialog(r, r.tenantId)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'copy',
                label: '复制路线',
                icon: 'ri:file-copy-line',
                auth: 'MdmProcessRoute:Copy'
              },
              {
                key: 'steps',
                label: '工艺维护',
                icon: 'ri:git-commit-line',
                auth: 'MdmProcessRoute:Edit'
              },
              {
                key: 'delete',
                label: '删除',
                icon: 'ri:delete-bin-6-line',
                color: 'var(--el-color-danger)',
                auth: 'MdmProcessRoute:Delete',
                disabled: routeDeleteBusy.value
              }
            ]}
            onClick={(item) => handleMore(r, String(item.key))}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  async function remove(row: ProcessRoute) {
    await deleteRoute({
      resource: { id: row.id, label: `${row.code} · ${row.name}` },
      permission: 'MdmProcessRoute:Delete',
      remove: () =>
        deleteProcessRoute(row.id, {
          showMessage: false,
          showErrorMessage: false,
          showReferenceFeedback: false
        }),
      onDeleted: async () => {
        ElMessage.success('工艺路线已删除')
        await refresh()
      }
    })
  }
  async function copyRoute(row: ProcessRoute) {
    try {
      const name = await promptText('复制会保留全部序列、工序及页签配置。', '复制工艺路线', {
        initialValue: `${row.name} - 副本`,
        placeholder: '请输入新路线名称',
        maxLength: 100
      })
      await copyProcessRoute(row.id, name)
      await refresh()
    } catch {
      /* Prompt cancellation and API feedback need no duplicate message. */
    }
  }
  function handleMore(row: ProcessRoute, key: string) {
    if (key === 'copy') void copyRoute(row)
    else if (key === 'steps') void openStepsDialog(row)
    else void remove(row)
  }
  async function exportRows() {
    try {
      const rows = await loadAllLinePages<ProcessRoute, WorkspaceQuery>(
        async (query) => {
          const response = await fetchProcessRoutes(query)
          if (response.total > 10000)
            throw new Error('导出数据不能超过 10000 行，请缩小筛选范围后重试')
          return response
        },
        {
          ...search,
          tenantId: effectiveTenantId.value || '',
          groupId: groupState.selectedId || undefined,
          groupIds: selectedGroupIds.value,
          current: 1,
          size: 500
        }
      )
      if (!rows.length) {
        ElMessage.info('当前筛选范围没有可导出的工艺路线')
        return
      }
      await exportExcel({
        data: rows.map((r) => ({
          code: r.material?.materialCode,
          product: r.material?.materialName,
          spec: r.material?.specificationModel,
          name: r.name
        })),
        columns: [
          { key: 'code', title: '产品编码' },
          { key: 'product', title: '产品名称' },
          { key: 'spec', title: '规格型号' },
          { key: 'name', title: '路线名称' }
        ],
        filename: '工艺路线'
      })
    } catch (error) {
      notifyFriendlyError(error, '工艺路线导出失败，请检查网络后重试')
    }
  }
  const actions: ArtTableQueryHeaderAction[] = [
    {
      type: 'add',
      label: '新增路线',
      permission: 'MdmProcessRoute:Add',
      onClick: () => void openRouteDialog(undefined, effectiveTenantId.value || undefined)
    },
    {
      type: 'import',
      label: '导入',
      permission: 'MdmProcessRoute:Import',
      importColumns: [
        { key: 'materialId', title: '产品物料ID', required: true },
        { key: 'name', title: '路线名称' },
        { key: 'version', title: '工艺版本' },
        { key: 'batchFrom', title: '批量从' },
        { key: 'batchTo', title: '批量至' },
        { key: 'effectiveDate', title: '生效日期' },
        { key: 'expiryDate', title: '失效日期' }
      ],
      importRecordTransformer: (rows) =>
        rows.map((row) => ({
          ...row,
          tenantId: effectiveTenantId.value || '',
          code: '',
          routeType: 'standard',
          allocationMode: 'quantity',
          groupId: null,
          batchFrom: row.batchFrom || null,
          batchTo: row.batchTo || 9999999999,
          productionUnitId: null,
          departmentId: null,
          effectiveDate: row.effectiveDate || dayjs().format('YYYY-MM-DD'),
          expiryDate: row.expiryDate || '9999-12-31',
          isDefault: false,
          source: 'manual',
          customUnitConversion: false,
          enabled: true,
          path: '',
          remark: ''
        })),
      importApi: (rows) => importProcessRoutes(rows as ProcessRouteInput[])
    },
    { type: 'export', permission: 'MdmProcessRoute:Export', onClick: exportRows }
  ]

  const tenantChoices = () =>
    tenantOptions.value.map((tenant) => ({
      label: `${tenant.tenantName || tenant.tenantCode}（${tenant.tenantCode}）`,
      value: tenant.id
    }))

  async function loadGroups() {
    groupState.loading = true
    groupState.error = ''
    try {
      groupState.rows = await fetchMasterGroups('process-route', effectiveTenantId.value)
    } catch (error) {
      groupState.error = getFriendlySupabaseErrorMessage(error, '分组加载失败，请重试')
    } finally {
      groupState.loading = false
    }
  }
  function selectGroup(id: string) {
    groupState.selectedId = id
    void tableRef.value?.getData()
  }
  async function openGroupAdd(parent?: MasterGroup): Promise<void> {
    await groupDialog.value?.handleOpen({
      domain: 'process-route',
      tenantId: parent?.tenantId || effectiveTenantId.value || '',
      tenantOptions: tenantChoices(),
      groups: groupState.rows,
      parent
    })
  }
  async function openGroupEdit(row: MasterGroup): Promise<void> {
    await groupDialog.value?.handleOpen({
      domain: 'process-route',
      tenantId: row.tenantId,
      tenantOptions: tenantChoices(),
      groups: groupState.rows,
      row
    })
  }
  async function removeGroup(row: MasterGroup) {
    const resource = { id: row.id, label: `${row.name} · ${row.code}` }
    await deleteGroups({
      resources: [resource],
      permission: 'MdmProcessRoute:ManageGroup',
      remove: () =>
        deleteMasterGroup(resource.id, {
          showMessage: false,
          showErrorMessage: false,
          showReferenceFeedback: false
        }),
      onDeleted: async () => {
        ElMessage.success('工艺路线分组已删除')
        if (groupState.selectedId === resource.id) groupState.selectedId = ''
        await loadGroups()
        await refresh()
      }
    })
  }
  let routeNavigationRequest = 0
  async function locateReferencedRoute(id: string) {
    const request = ++routeNavigationRequest
    const assertScope = createTenantScopeReadGuard()
    if (!hasAuth('MdmProcessRoute:View')) return
    try {
      const row = await fetchProcessRouteById(id)
      assertScope()
      if (request !== routeNavigationRequest) return
      if (!hasAuth('MdmProcessRoute:View')) {
        ElMessage.warning('查看权限已变化，请刷新页面后重试')
        return
      }
      if (!row) {
        ElMessage.warning('所属路线已不存在或当前账号无权查看，请重新检查关联')
        return
      }
      groupState.selectedId = ''
      Object.assign(search, { keyword: row.code, enabled: undefined })
      await refresh()
    } catch (error) {
      notifyFriendlyError(error, '所属路线定位失败，请重试')
    }
  }
  const navigationRoute = useRoute()
  watch(
    () => navigationRoute.query,
    (query) => {
      routeNavigationRequest++
      if (query.fromMasterDelete !== '1') return
      if (
        typeof query.routeId === 'string' &&
        ['mdm_process_route_sequence', 'mdm_process_route_step'].includes(
          String(query.dependencyCode)
        )
      ) {
        void locateReferencedRoute(query.routeId)
        return
      }
    },
    { immediate: true }
  )
  watch(
    [() => navigationRoute.query, () => groupState.rows],
    ([query]) => {
      if (query.fromMasterDelete !== '1') return
      if (query.dependencyCode === 'mdm_master_group' && typeof query.recordId === 'string') {
        if (groupState.rows.some((group) => group.id === query.recordId))
          selectGroup(query.recordId)
      } else if (
        query.dependencyCode === 'mdm_process_route' &&
        typeof query.recordNo === 'string'
      ) {
        groupState.selectedId = ''
        Object.assign(search, { keyword: query.recordNo, enabled: undefined })
        void refresh()
      }
    },
    { immediate: true }
  )
  async function handleGroupSaved() {
    await loadGroups()
    await refresh()
  }
  async function loadContext() {
    Object.assign(search, { keyword: '', enabled: undefined })
    groupState.selectedId = ''
    await tenantScopeStore.loadTenantOptions()
    await Promise.all(
      [
        'commonBoolean',
        'mdmProcessRouteType',
        'mdmProcessRouteAllocationMode',
        'mdmProcessRouteSource'
      ].map((code) => userStore.ensureDictLoaded(code))
    )
    await loadGroups()
    await tableRef.value?.getData()
  }
  watch(effectiveTenantId, () => void loadContext(), { immediate: true })
</script>

<style scoped lang="scss">
  .process-route-page {
    gap: 12px;
    min-width: 0;

    &__workspace {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      min-height: 0;
    }

    :deep(.process-route-page__route-name) {
      display: grid;
      gap: 3px;
      min-width: 0;

      strong,
      small {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.process-route-page__version) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 24px;
      padding: 2px 8px;
      font-size: 11px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 16%, transparent);
      border-radius: 999px;
    }

    :deep(.process-route-page__muted) {
      color: var(--el-text-color-placeholder);
    }
  }
</style>
