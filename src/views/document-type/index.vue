<template>
  <ArtPermissionGuard permission="MdmDocumentType:View" resource-name="单据类型">
    <div class="document-type-page business-workspace-page art-full-height">
      <MasterDeleteProcessingNotice :table="tableRef" />
      <BusinessWorkspaceHeader
        density="compact"
        eyebrow="DOCUMENT TYPE GOVERNANCE"
        title="单据类型"
        description="按业务菜单统一维护单据类型的稳定编号、默认项与展示规则，为各单据页面提供一致、可审计的类型口径。"
        icon="ri:file-list-3-line"
        :tags="workspaceTags"
        :metrics="workspaceMetrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="document-type-page__workspace">
        <ArtWorkspaceSplitter :breakpoint="1200" narrow-mode="hide">
          <template #primary>
            <aside v-if="isDesktopMenuLayout" class="document-type-page__menu-panel">
              <DocumentTypeMenuFilter
                subject="单据类型"
                :data="menu.tree"
                :counts="overview.stats.menuCounts"
                :selected-menu-id="menu.selectedId"
                :loading="menu.loading"
                @select="handleMenuSelect"
                @refresh="refreshContext"
              />
            </aside>
          </template>

          <div class="document-type-page__table-workspace">
            <section
              v-if="!isDesktopMenuLayout"
              class="document-type-page__mobile-menu art-card-xs"
            >
              <span aria-hidden="true"><ArtSvgIcon icon="ri:node-tree" /></span>
              <div>
                <small>当前功能范围</small>
                <strong>{{ selectedMenuLabel }}</strong>
              </div>
              <ElButton type="primary" plain @click="openMenuDrawer">
                <ArtSvgIcon icon="ri:filter-3-line" />
                菜单筛选
              </ElButton>
            </section>

            <ArtTableQuery
              ref="tableRef"
              v-model="table.search"
              :api-fn="fetchRows"
              :search-items="table.searchItems"
              :columns-factory="columnsFactory"
              :header-actions="table.headerActions"
              :selection-actions="table.selectionActions"
              :immediate="false"
              header-actions-placement="workspace"
              :table-header-props="{ layout: 'refresh,size,fullscreen,columns,settings' }"
              :table-props="tableProps"
              focus-scope-selector=".document-type-page__workspace"
              focusable
            />
          </div>
        </ArtWorkspaceSplitter>
      </div>

      <DocumentTypeDialog ref="dialogRef" @success="handleSaved" />
      <DocumentTypeDetailDrawer ref="detailDrawerRef" />
      <MasterDataDeleteGuard ref="deleteGuardRef" />
      <ArtDrawer ref="menuDrawerRef">
        <DocumentTypeMenuFilter
          subject="单据类型"
          class="document-type-page__drawer-filter"
          :data="menu.tree"
          :counts="overview.stats.menuCounts"
          :selected-menu-id="menu.selectedId"
          :loading="menu.loading"
          @select="handleDrawerMenuSelect"
          @refresh="refreshContext"
        />
      </ArtDrawer>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import { createMenuPathResolver, resolveMenuLabel } from '@/utils/navigation/menu'
  import dayjs from 'dayjs'
  import { ElMessage, ElTag } from 'element-plus'
  import type { CSSProperties, ComputedRef, UnwrapNestedRefs } from 'vue'
  import { useMediaQuery } from '@vueuse/core'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import MasterDeleteProcessingNotice from '@/components/business/master-delete-processing-notice/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext,
    ArtTableQueryTableProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { recordDeleteGuardOptions } from '@/hooks/core/useRecordDeleteGuard'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { formatWithDayjs } from '@/utils/time'
  import {
    getFriendlySupabaseErrorMessage,
    markErrorAsUserNotified,
    wasErrorUserNotified
  } from '@/utils/supabase/error'
  import TreeUtils from '@/utils/tree'
  import {
    deleteDocumentTypes,
    exportDocumentTypes,
    fetchDocumentTypeBusinessReferenceStatuses,
    fetchDocumentTypeList,
    fetchDocumentTypeMenuTree,
    fetchDocumentTypeStats,
    type DocumentTypeExportRecord,
    type DocumentTypeMenuNode,
    type DocumentTypeQuery,
    type DocumentTypeRecord,
    type DocumentTypeStats
  } from '@mdm/api'
  import DocumentTypeDialog, {
    type DocumentTypeDialogOpenData
  } from './modules/document-type-dialog.vue'
  import DocumentTypeDetailDrawer, {
    type DocumentTypeDetailData
  } from './modules/document-type-detail-drawer.vue'
  import DocumentTypeMenuFilter from '../components/menu-type-filter.vue'

  defineOptions({ name: 'MdmDocumentTypeWorkspace' })

  const declaredPermissions = [
    'MdmDocumentType:View',
    'MdmDocumentType:Add',
    'MdmDocumentType:Copy',
    'MdmDocumentType:Edit',
    'MdmDocumentType:Delete',
    'MdmDocumentType:Export'
  ] as const
  void declaredPermissions

  interface SearchModel {
    keyword: string
    enabled?: boolean
    isDefault?: boolean
  }

  interface TableGroup {
    search: SearchModel
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
    selectionActions: ComputedRef<ArtTableQueryHeaderAction[]>
  }

  interface MenuGroup {
    tree: DocumentTypeMenuNode[]
    selectedId: string
    loading: boolean
  }

  interface OverviewGroup {
    stats: DocumentTypeStats
    metrics: ComputedRef<BusinessWorkspaceMetric[]>
  }

  type TableParams = SearchModel & Pick<DocumentTypeQuery, 'current' | 'size'>
  type ExportRow = DocumentTypeExportRecord & { menuPath: string; statusLabel: string }

  const route = useRoute()
  const referencedRecordNo = computed(() =>
    route.query.fromMasterDelete === '1' &&
    route.query.dependencyCode === 'mdm_document_type' &&
    typeof route.query.recordNo === 'string'
      ? route.query.recordNo
      : ''
  )
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<{ handleOpen: (data: DocumentTypeDialogOpenData) => Promise<void> }>()
  const detailDrawerRef = ref<{ handleOpen: (data: DocumentTypeDetailData) => Promise<void> }>()
  const menuDrawerRef = ref<ArtDrawerExpose<Record<string, never>>>()
  const isDesktopMenuLayout = useMediaQuery('(min-width: 1201px)')
  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, isAllTenants, scopeLabel, tenantOptions } =
    storeToRefs(tenantScopeStore)
  const { hasAuth, hasAnyAuth } = useAuth()
  const { confirmDelete } = useArtFeedback()
  const deleteGuardRef = ref<InstanceType<typeof MasterDataDeleteGuard>>()
  const deleteBusy = ref(false)
  const inspectDeleteReferences = async (rows: DocumentTypeRecord[]): Promise<boolean> => {
    if (!deleteGuardRef.value) {
      ElMessage.error('关联校验尚未就绪，请刷新页面后重试删除')
      return true
    }
    const options = recordDeleteGuardOptions(
      { table: 'mdm_document_type', ids: rows.map((row) => row.id) },
      '单据类型',
      rows.map((row) => ({
        id: row.id,
        label: `${row.documentTypeName} · ${row.documentTypeCode}`
      }))
    )
    if (!options.fetchDependencies) return true
    const fetchDependencies = options.fetchDependencies
    return deleteGuardRef.value.inspect({
      ...options,
      fetchDependencies: async (ids) => {
        const references = await fetchDependencies(ids)
        const statusById = await fetchDocumentTypeBusinessReferenceStatuses(
          references
            .filter((row) => row.dependencyCode === 'mdm_business_type' && row.targetId)
            .map((row) => row.targetId)
        )
        return references.map((row) => ({
          ...row,
          recordStatus: statusById.get(row.targetId) ?? row.recordStatus
        }))
      }
    })
  }
  const canManage = computed(() =>
    hasAnyAuth([
      'MdmDocumentType:Add',
      'MdmDocumentType:Copy',
      'MdmDocumentType:Edit',
      'MdmDocumentType:Delete'
    ])
  )
  const showTenantColumn = computed(() => isAllTenants.value)

  const menu: UnwrapNestedRefs<MenuGroup> = reactive<MenuGroup>({
    tree: [],
    selectedId:
      !referencedRecordNo.value && typeof route.query.menuId === 'string' ? route.query.menuId : '',
    loading: false
  })
  const overview: UnwrapNestedRefs<OverviewGroup> = reactive<OverviewGroup>({
    stats: {
      total: 0,
      enabled: 0,
      defaults: 0,
      menuCount: 0,
      tenantCount: 0,
      menuCounts: {}
    },
    metrics: computed(() => [
      {
        label: '类型总数',
        value: overview.stats.total,
        description: '当前租户与菜单范围内的主数据',
        icon: 'ri:file-list-3-line',
        tone: 'primary'
      },
      {
        label: '已启用',
        value: overview.stats.enabled,
        description: '可供新业务单据引用',
        icon: 'ri:checkbox-circle-line',
        tone: 'success'
      },
      {
        label: '默认类型',
        value: overview.stats.defaults,
        description: '已为菜单设置默认选择',
        icon: 'ri:star-line',
        tone: overview.stats.defaults ? 'warning' : 'info'
      },
      {
        label: '覆盖菜单',
        value: overview.stats.menuCount,
        description: '已建立单据类型的功能页面',
        icon: 'ri:node-tree',
        tone: 'info'
      }
    ])
  })

  const workspaceTags = computed<BusinessWorkspaceTag[]>(() => [
    {
      label: canManage.value ? '已授权维护' : '安全只读视图',
      type: canManage.value ? 'primary' : 'info'
    },
    { label: `数据范围：${scopeLabel.value}`, type: 'success' },
    { label: `最近更新：${formatWithDayjs(overview.stats.lastUpdateTime) || '-'}` }
  ])
  const workspaceMetrics = computed(() => overview.metrics)
  const booleanOptions = useDictionaryOptions(
    'commonBoolean',
    (value) => value === 'true' || value === '1'
  )
  const selectedMenu = computed(() =>
    menu.selectedId ? treeUtils.findNode(menu.tree, menu.selectedId) : undefined
  )
  const selectedMenuLabel = computed(() =>
    selectedMenu.value ? resolveMenuLabel(selectedMenu.value) : '全部功能'
  )
  const selectedMenuIds = computed(() =>
    menu.selectedId
      ? treeUtils.getDescendants(menu.tree, menu.selectedId, true).map((item) => item.id)
      : undefined
  )

  const table: UnwrapNestedRefs<TableGroup> = reactive<TableGroup>({
    search: {
      keyword: referencedRecordNo.value,
      enabled: undefined,
      isDefault: undefined
    },
    searchItems: computed<SearchFormItem[]>(() => [
      {
        key: 'keyword',
        label: '关键字',
        type: 'input',
        props: { clearable: true, placeholder: '搜索类型编号、名称或备注' }
      },
      {
        key: 'enabled',
        label: '状态',
        type: 'select',
        props: { clearable: true, placeholder: '全部状态', options: booleanOptions }
      },
      {
        key: 'isDefault',
        label: '默认类型',
        type: 'select',
        props: { clearable: true, placeholder: '全部类型', options: booleanOptions }
      }
    ]),
    headerActions: computed<ArtTableQueryHeaderAction[]>(() => [
      {
        type: 'add',
        label: '新增单据类型',
        permission: 'MdmDocumentType:Add',
        onClick: () => openDialog('add')
      },
      {
        key: 'copy',
        label: '复制',
        icon: 'ri:file-copy-line',
        permission: 'MdmDocumentType:Copy',
        selectionRequired: false,
        disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
        onClick: ({ selectedRows }) => openDialog('copy', selectedRows[0] as DocumentTypeRecord)
      },
      {
        type: 'export',
        label: '导出',
        permission: 'MdmDocumentType:Export',
        exportFilename: () => `单据类型_${dayjs().format('YYYYMMDD_HHmm')}`,
        exportSheetName: '单据类型',
        exportColumns: [
          { key: 'menuPath', title: '所属菜单功能' },
          { key: 'documentTypeCode', title: '单据类型编号' },
          { key: 'documentTypeName', title: '单据类型名称' },
          { key: 'isDefault', title: '默认单据类型', formatter: (value) => (value ? '是' : '否') },
          { key: 'remark', title: '备注' },
          { key: 'sortOrder', title: '排序' },
          { key: 'textColor', title: '文字颜色' },
          { key: 'tagStyle', title: '标签样式' },
          { key: 'statusLabel', title: '状态' },
          ...(showTenantColumn.value
            ? [
                { key: 'tenantName', title: '所属租户' },
                { key: 'tenantCode', title: '租户编码' }
              ]
            : [])
        ],
        exportApi: async ({ searchParams, maxRows }) => {
          const rows = await exportDocumentTypes({
            tenantId: effectiveTenantId.value,
            menuIds: selectedMenuIds.value,
            keyword: String(searchParams.keyword ?? ''),
            enabled: typeof searchParams.enabled === 'boolean' ? searchParams.enabled : undefined,
            isDefault:
              typeof searchParams.isDefault === 'boolean' ? searchParams.isDefault : undefined,
            limit: maxRows
          })
          return rows.map<ExportRow>((row) => ({
            ...row,
            menuPath: menuPathResolver.value.resolveMany(row.menuIds),
            statusLabel: row.enabled ? '启用' : '禁用'
          }))
        }
      }
    ]),
    selectionActions: computed<ArtTableQueryHeaderAction[]>(() => [
      {
        type: 'delete',
        permission: 'MdmDocumentType:Delete',
        confirm: false,
        onClick: ({ selectedRows }) => removeRows(selectedRows as DocumentTypeRecord[])
      }
    ])
  })

  const tableProps: ArtTableQueryTableProps = {
    rowKey: 'id',
    tableLayout: 'fixed',
    height: '100%',
    showOverflowTooltip: true,
    emptyText: '当前菜单暂无单据类型',
    emptyDescription: '可切换左侧菜单或调整筛选条件；有权限的用户可以新增第一条类型。'
  }

  const fetchRows = (params: TableParams, options?: { signal?: AbortSignal }) =>
    fetchDocumentTypeList(
      {
        ...params,
        tenantId: effectiveTenantId.value,
        menuIds: selectedMenuIds.value
      },
      options
    )

  const columnsFactory = (): ColumnOption<DocumentTypeRecord>[] => [
    {
      type: 'selection',
      width: 50,
      fixed: 'left',
      reserveSelection: true,
      selectable: () => hasAuth('MdmDocumentType:Copy') || hasAuth('MdmDocumentType:Delete')
    },
    {
      prop: 'documentTypeName',
      label: '单据类型',
      minWidth: 250,
      fixed: 'left',
      link: { permission: 'MdmDocumentType:View', onClick: openDetail },
      formatter: (row) => (
        <div class="document-type-identity">
          <span class="document-type-identity__icon" aria-hidden="true">
            <ArtSvgIcon icon={row.isDefault ? 'ri:star-fill' : 'ri:file-list-3-line'} />
          </span>
          <div>
            <span class="document-type-identity__heading">
              <strong title={row.documentTypeName}>{row.documentTypeName}</strong>
              {row.isDefault ? <em>默认</em> : null}
              {row.packingEnabled ? (
                <ElTag size="small" type="success" effect="plain">
                  需排包
                </ElTag>
              ) : null}
            </span>
            <code title={row.documentTypeCode} translate="no">
              {row.documentTypeCode}
            </code>
          </div>
        </div>
      )
    },
    {
      prop: 'menuId',
      label: '所属菜单功能',
      minWidth: 230,
      formatter: (row) => (
        <div class="document-type-menu-cell">
          <strong title={menuPathResolver.value.resolveMany(row.menuIds)}>
            {menuPathResolver.value.resolveMany(row.menuIds) || '--'}
          </strong>
          <small title={resolveMenuComponent(row.menuId)}>{row.menuIds.length} 个功能页面</small>
        </div>
      )
    },
    ...(showTenantColumn.value
      ? [
          {
            prop: 'tenant',
            label: '所属租户',
            minWidth: 154,
            formatter: (row: DocumentTypeRecord) => (
              <div class="document-type-tenant-cell">
                <strong>{row.tenant?.tenantName || '--'}</strong>
                <small>{row.tenant?.tenantCode || '--'}</small>
              </div>
            )
          } satisfies ColumnOption<DocumentTypeRecord>
        ]
      : []),
    {
      prop: 'tagStyle',
      label: '标签预览',
      minWidth: 150,
      formatter: (row) => (
        <ElTag
          type={row.tagStyle || 'primary'}
          effect="light"
          round
          style={{ color: row.textColor || undefined } as CSSProperties}
        >
          {row.documentTypeName}
        </ElTag>
      )
    },
    {
      prop: 'isDefault',
      label: '默认类型',
      width: 96,
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonBoolean" value={String(row.isDefault)} display="tag" />
      )
    },
    { prop: 'sortOrder', label: '排序', width: 82, sortable: true },
    {
      prop: 'enabled',
      label: '状态',
      width: 88,
      formatter: (row) => (
        <ArtDictDisplay dictCode="commonBoolean" value={String(row.enabled)} display="tag" />
      )
    },
    { prop: 'remark', label: '备注', minWidth: 190 },
    {
      prop: 'updateTime',
      label: '更新信息',
      minWidth: 170,
      formatter: (row) => (
        <div class="document-type-update-cell">
          <span>{formatWithDayjs(row.updateTime) || '--'}</span>
          <small>{row.updateBy || '系统维护'}</small>
        </div>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 160,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="view"
            permission="MdmDocumentType:View"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission="MdmDocumentType:Edit"
            onClick={() => openDialog('edit', row)}
          />
          <ArtButtonTable
            type="delete"
            permission="MdmDocumentType:Delete"
            disabled={deleteBusy.value}
            onClick={() => void removeRow(row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  const menuPathResolver = computed(() => createMenuPathResolver(menu.tree))

  const resolveMenuComponent = (menuId: string): string => {
    const item = treeUtils.findNode(menu.tree, menuId)
    return typeof item?.component === 'string' ? item.component : ''
  }

  const openDialog = (mode: 'add' | 'copy' | 'edit', record?: DocumentTypeRecord): void => {
    void dialogRef.value?.handleOpen({
      mode,
      record,
      selectedMenuId: menu.selectedId,
      menuTree: menu.tree,
      tenantOptions: tenantOptions.value.map((tenant) => ({
        label: `${tenant.tenantName}（${tenant.tenantCode}）`,
        value: tenant.id
      })),
      effectiveTenantId: effectiveTenantId.value
    })
  }

  const openDetail = (record: DocumentTypeRecord): void => {
    void detailDrawerRef.value?.handleOpen({
      record,
      menuPath: menuPathResolver.value.resolveMany(record.menuIds),
      isProductionType: record.menuIds.some(
        (id) => treeUtils.findNode(menu.tree, id)?.name === 'MesWorkOrder'
      )
    })
  }

  const removeRows = async (rows: DocumentTypeRecord[]): Promise<void> => {
    if (deleteBusy.value || !rows.length) return
    deleteBusy.value = true
    try {
      const blocked = await inspectDeleteReferences(rows)
      if (blocked) throw markErrorAsUserNotified(new Error('关联检查已显示'))
      await confirmDelete(
        rows.length === 1
          ? `确定删除单据类型“${rows[0].documentTypeName}”吗？`
          : `确定删除选中的 ${rows.length} 条单据类型吗？`
      )
      await deleteDocumentTypes(rows.map((row) => row.id))
      await Promise.all([tableRef.value?.refreshRemove(), loadStats()])
    } catch (error) {
      if (error === 'cancel' || error === 'close') {
        throw markErrorAsUserNotified(new Error('已取消删除'))
      }
      throw error
    } finally {
      deleteBusy.value = false
    }
  }

  const removeRow = async (row: DocumentTypeRecord): Promise<void> => {
    try {
      await removeRows([row])
    } catch (error) {
      if (!wasErrorUserNotified(error)) {
        ElMessage.error(getFriendlySupabaseErrorMessage(error, '单据类型删除失败，请重试'))
      }
    }
  }

  const loadStats = async (): Promise<void> => {
    Object.assign(overview.stats, await fetchDocumentTypeStats(effectiveTenantId.value))
  }

  const loadMenuTree = async (): Promise<void> => {
    menu.tree = await fetchDocumentTypeMenuTree()
    if (menu.selectedId && !treeUtils.findNode(menu.tree, menu.selectedId)) menu.selectedId = ''
  }

  const refreshContext = async (): Promise<void> => {
    menu.loading = true
    try {
      await Promise.all([loadMenuTree(), loadStats()])
      await tableRef.value?.getData()
    } finally {
      menu.loading = false
    }
  }

  const handleMenuSelect = async (menuId: string): Promise<void> => {
    if (menu.selectedId === menuId) return
    menu.selectedId = menuId
    await tableRef.value?.getData()
  }

  const handleDrawerMenuSelect = async (menuId: string): Promise<void> => {
    await handleMenuSelect(menuId)
    await menuDrawerRef.value?.handleClose()
  }

  const openMenuDrawer = async (): Promise<void> => {
    await menuDrawerRef.value?.handleOpen(
      {},
      {
        title: '筛选菜单功能',
        subtitle: '选择目录时，右侧列表会包含全部下级菜单的单据类型。',
        size: 'sm',
        contentHeight: 'calc(100vh - 118px)',
        showFooter: false,
        drawerProps: {
          appendToBody: true,
          bodyClass: 'document-type-menu-filter-drawer__body'
        }
      }
    )
  }

  const handleSaved = (mode: 'add' | 'edit'): void => {
    void Promise.all([
      mode === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate(),
      loadStats()
    ])
  }

  const initialize = async (): Promise<void> => {
    menu.loading = true
    try {
      await Promise.all([
        userStore.ensureDictLoaded('commonBoolean'),
        tenantScopeStore.loadTenantOptions(),
        loadMenuTree(),
        loadStats()
      ])
      await tableRef.value?.getData()
    } finally {
      menu.loading = false
    }
  }

  onMounted(() => void initialize())
  watch(referencedRecordNo, (recordNo) => {
    table.search.keyword = recordNo
    if (recordNo) menu.selectedId = ''
    void tableRef.value?.getData()
  })
  watch(effectiveTenantId, () => void refreshContext())
</script>

<style scoped lang="scss">
  .document-type-page {
    gap: 12px;
    min-width: 0;
    overflow: hidden;

    &__workspace {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    &__menu-panel,
    &__table-workspace {
      min-width: 0;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    &__table-workspace {
      display: flex;
      flex-direction: column;
    }

    &__mobile-menu {
      display: flex;
      flex: none;
      gap: var(--art-space-3);
      align-items: center;
      min-width: 0;
      padding: var(--art-space-3) var(--art-space-4);
      margin-bottom: var(--art-space-3);

      > span {
        display: inline-flex;
        flex: 0 0 36px;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
        border: 1px solid color-mix(in srgb, var(--theme-color) 18%, var(--art-card-border));
        border-radius: var(--art-control-radius);
      }

      > div {
        display: grid;
        flex: 1;
        min-width: 0;
      }

      small,
      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      strong {
        font-size: 14px;
        color: var(--el-text-color-primary);
      }
    }

    &__drawer-filter {
      height: 100%;
      border: 0;
      border-radius: 0;
    }

    :deep(.art-table-query) {
      flex: 1 1 auto;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    :deep(.document-type-identity) {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      min-width: 0;

      > div {
        min-width: 0;
      }

      code {
        display: block;
        margin-top: 3px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }
    }

    :deep(.document-type-identity__icon) {
      display: grid;
      flex: 0 0 34px;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border-radius: var(--art-control-radius);
    }

    :deep(.document-type-identity__heading) {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }

      em {
        flex: none;
        padding: 1px 6px;
        font-size: 10px;
        font-style: normal;
        line-height: 18px;
        color: var(--el-color-warning-dark-2);
        background: var(--el-color-warning-light-9);
        border-radius: 999px;
      }
    }

    :deep(.document-type-menu-cell),
    :deep(.document-type-tenant-cell),
    :deep(.document-type-update-cell) {
      display: grid;
      min-width: 0;

      strong,
      span,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        margin-top: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.document-type-menu-cell strong),
    :deep(.document-type-tenant-cell strong) {
      color: var(--el-text-color-primary);
    }
  }

  :global(.document-type-menu-filter-drawer__body) {
    --art-drawer-content-padding: 0;

    padding: 0 !important;
    overflow: hidden !important;
  }
</style>
