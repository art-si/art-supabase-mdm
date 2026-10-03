<template>
  <ArtPermissionGuard permission="MdmWorkstation:View" resource-name="工位配置">
    <div class="production-workspace workstation-page business-workspace-page art-full-height">
      <ProductionWorkspaceHeader
        title="工位配置"
        description="按车间与工作中心划分装配工位，统一维护现场负责人、安灯设备标识和可用状态。"
        icon="ri:layout-grid-line"
        capability="装配工位划分"
        :metrics="workspaceMetrics"
        density="compact"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </ProductionWorkspaceHeader>

      <div class="production-workspace__body workstation-page__workspace">
        <ArtWorkspaceSplitter
          primary-size="300px"
          primary-min="256px"
          primary-max="400px"
          :breakpoint="900"
          stacked-primary-size="360px"
        >
          <template #primary>
            <WorkCenterNavigator
              :workshops="workshopOptions"
              :work-centers="workCentersForWorkshop"
              :selected-workshop-id="scope.selectedWorkshopId"
              :selected-work-center-id="scope.selectedWorkCenterId"
              :loading="scope.loading"
              :error="scope.error"
              @refresh="loadScope"
              @select-workshop="selectWorkshop"
              @select-work-center="selectWorkCenter"
            />
          </template>

          <div class="workstation-page__main">
            <ArtEntitySummary
              compact
              icon="ri:dashboard-3-line"
              eyebrow="CURRENT WORK CENTER"
              :title="selectedWorkCenterLabel"
              :description="selectedScopeDescription"
            >
              <template #aside>
                <ElTag v-if="selectedWorkCenter" type="primary" effect="plain">
                  {{ overview.total }} 个工位
                </ElTag>
              </template>
            </ArtEntitySummary>

            <ArtTableQuery
              ref="tableRef"
              v-model="table.search"
              :api-fn="fetchRows"
              :search-items="searchItems"
              :columns-factory="columnsFactory"
              :header-actions="headerActions"
              header-actions-placement="workspace"
              :selection-actions="selectionActions"
              :enable-cache="false"
              focusable
              focus-scope-selector=".workstation-page__workspace"
              :table-props="{
                rowKey: 'id',
                tableLayout: 'fixed',
                emptyText: selectedWorkCenter ? '暂无匹配工位' : '请先选择工作中心',
                emptyDescription: selectedWorkCenter
                  ? '可调整右侧筛选条件，或为当前工作中心新增工位。'
                  : '从左侧选择车间和工作中心后，工位数据将在此显示。'
              }"
              :search-bar-props="{ span: 8, labelWidth: 72, showExpand: false }"
            />
          </div>
        </ArtWorkspaceSplitter>
      </div>

      <WorkstationDialog ref="dialogRef" @success="handleSaved" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { cloneDeep } from 'lodash-es'
  import { ElMessage, ElTag } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { BusinessWorkspaceMetric } from '@/components/business/business-workspace-header/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableIdentityCell from '@/components/business/business-table-identity-cell/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import { exportExcel } from '@/utils/file'
  import {
    deleteWorkstations,
    fetchWorkstationScope,
    fetchWorkstations,
    type ProductionDepartment,
    type Workstation,
    type WorkstationQuery,
    type WorkstationScopeCenter
  } from '@mdm/api'
  import ProductionWorkspaceHeader from '../../production/modules/production-workspace-header.vue'
  import { productionTree } from '../../production/modules/production-model'
  import WorkCenterNavigator, {
    type ProductionScopeWorkshopOption as WorkstationWorkshopOption
  } from '@/components/business/production-work-center-navigator/index.vue'
  import WorkstationDialog from './modules/workstation-dialog.vue'

  defineOptions({ name: 'MdmWorkstation' })

  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, tenantOptions } = storeToRefs(tenantScopeStore)
  const { getDictMap } = storeToRefs(userStore)
  const { confirmDelete } = useArtFeedback()
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<InstanceType<typeof WorkstationDialog>>()

  const scope = reactive({
    departments: [] as ProductionDepartment[],
    workCenters: [] as WorkstationScopeCenter[],
    selectedWorkshopId: '',
    selectedWorkCenterId: '',
    loading: false,
    error: ''
  })
  const table = reactive({
    search: { keyword: '', enabled: undefined as boolean | undefined }
  })
  const overview = reactive({
    total: 0,
    enabled: 0,
    rows: [] as Workstation[]
  })

  void userStore.ensureDictLoaded('commonBoolean')

  const departmentTree = computed(() => productionTree.listToTree(scope.departments))
  const selectedWorkshop = computed(() =>
    scope.departments.find((item) => item.id === scope.selectedWorkshopId)
  )
  const selectedWorkCenter = computed(() =>
    scope.workCenters.find((item) => item.id === scope.selectedWorkCenterId)
  )

  function descendantDepartmentIds(departmentId: string): string[] {
    return productionTree
      .getDescendants(departmentTree.value, departmentId, true)
      .map((item) => String(item.id))
  }

  function departmentPath(department: ProductionDepartment): string {
    const path = productionTree
      .getAncestors(departmentTree.value, department.id)
      .map((item) => String(item.name))
      .join(' / ')
    if (effectiveTenantId.value) return path || department.name
    const tenant = tenantOptions.value.find((item) => item.id === department.tenantId)
    return `${tenant?.tenantName || '当前租户'} / ${path || department.name}`
  }

  const workshopOptions = computed<WorkstationWorkshopOption[]>(() =>
    scope.departments
      .filter((department) => {
        if (!department.enabled || !department.parentId) return false
        const departmentIds = descendantDepartmentIds(department.id)
        return scope.workCenters.some(
          (center) =>
            center.tenantId === department.tenantId && departmentIds.includes(center.departmentId)
        )
      })
      .map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
        path: departmentPath(department)
      }))
  )

  const workCentersForWorkshop = computed(() => {
    if (!selectedWorkshop.value) return []
    const departmentIds = descendantDepartmentIds(selectedWorkshop.value.id)
    return scope.workCenters.filter(
      (center) =>
        center.tenantId === selectedWorkshop.value?.tenantId &&
        departmentIds.includes(center.departmentId)
    )
  })

  const selectedWorkCenterLabel = computed(() =>
    selectedWorkCenter.value
      ? `${selectedWorkCenter.value.code} · ${selectedWorkCenter.value.name}`
      : '等待选择工作中心'
  )
  const selectedScopeDescription = computed(() =>
    selectedWorkshop.value
      ? `${departmentPath(selectedWorkshop.value)} · 工位将继承当前生产范围`
      : '从左侧选择车间和工作中心后开始维护工位。'
  )

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前工位',
      value: overview.total,
      description: selectedWorkCenter.value ? '所选工作中心下的工位' : '等待选择工作中心',
      icon: 'ri:layout-grid-line'
    },
    {
      label: '本页启用',
      value: overview.enabled,
      description: '可供下游生产业务引用',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '工作中心',
      value: workCentersForWorkshop.value.length,
      description: selectedWorkshop.value ? `属于“${selectedWorkshop.value.name}”` : '当前车间范围',
      icon: 'ri:dashboard-3-line'
    }
  ])

  const booleanOptions = computed(() =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      ...item,
      value: item.value === 'true' || item.value === '1'
    }))
  )
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'keyword',
      label: '工位',
      type: 'input',
      props: { clearable: true, placeholder: '编号 / 名称 / SIM 编号' }
    },
    {
      key: 'enabled',
      label: '启用状态',
      type: 'select',
      props: { clearable: true, placeholder: '全部状态', options: booleanOptions.value }
    }
  ])

  async function fetchRows(params: WorkstationQuery, options?: { signal?: AbortSignal }) {
    const response = await fetchWorkstations(
      {
        ...params,
        tenantId: selectedWorkCenter.value?.tenantId || effectiveTenantId.value,
        workCenterId: selectedWorkCenter.value?.id || ''
      },
      options
    )
    overview.total = response.total
    overview.rows = response.data
    overview.enabled = response.data.filter((row) => row.enabled).length
    return { records: response.data, total: response.total }
  }

  const columnsFactory = (): ColumnOption<Workstation>[] => [
    { type: 'selection', width: 48 },
    { type: 'globalIndex', label: '序号', width: 72 },
    {
      prop: 'workstationName',
      label: '工位',
      minWidth: 210,
      fixed: 'left',
      formatter: (row) => (
        <BusinessTableIdentityCell
          primary={row.workstationName}
          secondary={row.workstationCode}
          icon="ri:layout-grid-line"
        />
      )
    },
    {
      prop: 'responsiblePersonId',
      label: '工位负责人',
      minWidth: 170,
      formatter: (row) =>
        row.responsiblePerson ? (
          <div class="workstation-page__person">
            <strong>{row.responsiblePerson.name}</strong>
            <small>{row.responsiblePerson.employeeNo || '未设置工号'}</small>
          </div>
        ) : (
          <span class="workstation-page__muted">待配置</span>
        )
    },
    {
      prop: 'andonSimNo',
      label: '安灯盒子 SIM 编号',
      minWidth: 190,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.andonSimNo ? (
          <span class="workstation-page__sim">{row.andonSimNo}</span>
        ) : (
          <span class="workstation-page__muted">未绑定</span>
        )
    },
    {
      prop: 'enabled',
      label: '启用状态',
      width: 112,
      align: 'center',
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonBoolean" value={String(row.enabled)} display="tag" />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 128,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="edit"
            permission="MdmWorkstation:Edit"
            label="编辑工位"
            onClick={() => openDialog(row)}
          />
          <ArtButtonMore
            list={[
              {
                key: 'copy',
                label: '复制工位',
                icon: 'ri:file-copy-line',
                auth: 'MdmWorkstation:Copy'
              },
              {
                key: 'delete',
                label: '删除工位',
                icon: 'ri:delete-bin-6-line',
                color: 'var(--el-color-danger)',
                auth: 'MdmWorkstation:Delete'
              }
            ]}
            onClick={(item) => (item.key === 'copy' ? openDialog(row, true) : void removeRow(row))}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增工位',
      permission: 'MdmWorkstation:Add',
      disabled: () => !selectedWorkCenter.value,
      onClick: () => openDialog()
    },
    {
      key: 'copy',
      label: '复制',
      icon: 'ri:file-copy-line',
      permission: 'MdmWorkstation:Copy',
      selectionRequired: true,
      disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
      onClick: ({ selectedRows }: ArtTableQueryHeaderActionContext) =>
        openDialog(selectedRows[0] as Workstation, true)
    },
    {
      type: 'export',
      label: '导出',
      permission: 'MdmWorkstation:Export',
      onClick: exportRows
    }
  ])

  const selectionActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'delete',
      permission: 'MdmWorkstation:Delete',
      content: (context: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${context.selectedCount} 个工位吗？`,
      onClick: async (context: ArtTableQueryHeaderActionContext) => {
        await deleteWorkstations(context.selectedRows.map((row) => String(row.id)))
        await context.api.refreshRemove()
      }
    }
  ])

  function openDialog(row?: Workstation, copy = false): void {
    const department = row
      ? scope.departments.find((item) => item.id === row.departmentId)
      : selectedWorkshop.value
    const workCenter = row
      ? scope.workCenters.find((item) => item.id === row.workCenterId)
      : selectedWorkCenter.value
    if (!department || !workCenter) {
      ElMessage.warning('请先从左侧选择车间和工作中心')
      return
    }
    void dialogRef.value?.handleOpen({
      row: row ? cloneDeep(row) : undefined,
      copy,
      department,
      workCenter
    })
  }

  async function removeRow(row: Workstation): Promise<void> {
    await confirmDelete(`确定删除工位“${row.workstationName}”吗？`)
    await deleteWorkstations([row.id])
    await tableRef.value?.refreshRemove()
  }

  async function handleSaved(mode: 'add' | 'edit'): Promise<void> {
    if (mode === 'add') await tableRef.value?.refreshCreate()
    else await tableRef.value?.refreshUpdate()
  }

  function selectWorkshop(id: string): void {
    scope.selectedWorkshopId = id
    scope.selectedWorkCenterId = workCentersForWorkshop.value[0]?.id || ''
    Object.assign(table.search, { keyword: '', enabled: undefined })
    void tableRef.value?.getData()
  }

  function selectWorkCenter(id: string): void {
    scope.selectedWorkCenterId = id
    Object.assign(table.search, { keyword: '', enabled: undefined })
    void tableRef.value?.getData()
  }

  async function exportRows(): Promise<void> {
    if (!selectedWorkCenter.value) {
      ElMessage.info('请先选择需要导出的工作中心')
      return
    }
    try {
      const rows: Workstation[] = []
      for (let current = 1; current <= 10; current += 1) {
        const response = await fetchWorkstations({
          tenantId: selectedWorkCenter.value.tenantId,
          workCenterId: selectedWorkCenter.value.id,
          keyword: table.search.keyword,
          enabled: table.search.enabled,
          current,
          size: 1000
        })
        if (response.total > 10000) throw new Error('export-limit')
        rows.push(...response.data)
        if (rows.length >= response.total) break
      }
      if (!rows.length) {
        ElMessage.info('当前筛选范围没有可导出的工位')
        return
      }
      await exportExcel({
        data: rows.map((row) => ({
          workstationCode: row.workstationCode,
          workstationName: row.workstationName,
          workshop: row.department?.name || '—',
          workCenter: row.workCenter ? `${row.workCenter.code} · ${row.workCenter.name}` : '—',
          responsiblePerson: row.responsiblePerson?.name || '—',
          responsibleEmployeeNo: row.responsiblePerson?.employeeNo || '—',
          andonSimNo: row.andonSimNo || '未绑定',
          enabled: row.enabled ? '启用' : '禁用'
        })),
        columns: [
          { key: 'workstationCode', title: '工位编号' },
          { key: 'workstationName', title: '工位名称' },
          { key: 'workshop', title: '车间 / 产线' },
          { key: 'workCenter', title: '工作中心' },
          { key: 'responsiblePerson', title: '工位负责人' },
          { key: 'responsibleEmployeeNo', title: '负责人工号' },
          { key: 'andonSimNo', title: '安灯盒子 SIM 编号' },
          { key: 'enabled', title: '启用状态' }
        ],
        filename: `工位配置-${selectedWorkCenter.value.code}`
      })
    } catch {
      ElMessage.error('导出失败，请缩小筛选范围后重试')
    }
  }

  let scopeLoadVersion = 0
  async function loadScope(): Promise<void> {
    const version = ++scopeLoadVersion
    scope.loading = true
    scope.error = ''
    try {
      await tenantScopeStore.loadTenantOptions()
      const result = await fetchWorkstationScope(effectiveTenantId.value)
      if (version !== scopeLoadVersion) return
      Object.assign(scope, {
        departments: result.departments,
        workCenters: result.workCenters
      })
      if (!workshopOptions.value.some((item) => item.id === scope.selectedWorkshopId)) {
        scope.selectedWorkshopId = workshopOptions.value[0]?.id || ''
      }
      if (!workCentersForWorkshop.value.some((item) => item.id === scope.selectedWorkCenterId)) {
        scope.selectedWorkCenterId = workCentersForWorkshop.value[0]?.id || ''
      }
      await tableRef.value?.getData()
    } catch {
      if (version === scopeLoadVersion) scope.error = '车间与工作中心加载失败，请重试'
    } finally {
      if (version === scopeLoadVersion) scope.loading = false
    }
  }

  watch(effectiveTenantId, () => void loadScope(), { immediate: true })
</script>

<style scoped lang="scss">
  .workstation-page {
    &__workspace {
      min-height: 520px;
    }

    &__main {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      min-height: 0;

      > .art-table-query {
        flex: 1;
        min-height: 0;
      }
    }

    :deep(.workstation-page__person) {
      display: grid;
      min-width: 0;

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        font-weight: 500;
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.workstation-page__sim) {
      font-family: var(--art-font-family-mono, Consolas, monospace);
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-regular);
    }

    :deep(.workstation-page__muted) {
      color: var(--el-text-color-secondary);
    }

    @media (width <= 900px) {
      &__workspace {
        min-height: 920px;
      }
    }
  }
</style>
