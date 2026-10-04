<template>
  <ArtPermissionGuard permission="MdmPurchaseSupplier:View" resource-name="供应商">
    <div class="purchase-supplier-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="PURCHASE MASTER DATA"
        title="供应商"
        description="统一维护供应商身份、层级分组、银行账户和联系人，供业务系统实时引用。"
        icon="ri:store-2-line"
        :tags="[
          { label: '统一根数据', type: 'primary' },
          { label: '租户隔离', type: 'success' }
        ]"
        :metrics="metrics"
      >
        <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
      </BusinessWorkspaceHeader>

      <div class="purchase-supplier-page__workspace">
        <MasterGroupPanel
          title="供应商分组"
          :groups="groups"
          :selected-id="selectedGroupId"
          :loading="groupsLoading"
          :error="groupsError"
          manage-permission="MdmPurchaseSupplier:ManageGroup"
          @select="selectGroup"
          @refresh="loadGroups"
          @add="openGroupAdd"
          @edit="openGroupEdit"
          @remove="removeGroup"
        />
        <ArtTableQuery
          ref="tableRef"
          v-model="search"
          :api-fn="fetchRows"
          :search-items="searchItems"
          :columns-factory="columnsFactory"
          :header-actions="headerActions"
          :selection-actions="selectionActions"
          :immediate="false"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 8, labelWidth: 86, showExpand: false }"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: '暂无供应商',
            emptyDescription: '可新增供应商，并按左侧分组统一管理。'
          }"
          focus-scope-selector=".purchase-supplier-page__workspace"
          focusable
        />
      </div>

      <SupplierDialog ref="supplierDialogRef" @success="refreshAfterSave" />
      <SupplierDetail ref="detailRef" :groups="groups" @changed="refreshAfterSave('edit')" />
      <GroupDialog ref="groupDialogRef" @success="refreshAfterGroupSave" />
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import TreeUtils from '@/utils/tree'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryExcelColumn,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
  import {
    deleteMasterGroup,
    deletePurchaseSuppliers,
    fetchMasterGroups,
    fetchPurchaseSuppliers,
    type MasterGroup,
    type PurchaseSupplier,
    type SupplierQuery
  } from '@mdm/api'
  import MasterGroupPanel from '@/components/business/master-group-panel/index.vue'
  import GroupDialog, {
    type GroupDialogOpenData
  } from '../../components/operational-master/modules/group-dialog.vue'
  import SupplierDialog, { type SupplierDialogOpenData } from './modules/supplier-dialog.vue'
  import SupplierDetail from './modules/supplier-detail.vue'

  defineOptions({ name: 'MdmPurchaseSupplier' })
  const { confirmDelete } = useArtFeedback()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tenantScopeStore = useTenantScopeStore()
  const { effectiveTenantId, tenantOptions } = storeToRefs(tenantScopeStore)
  const tableRef = ref<ArtTableQueryExpose>()
  const supplierDialogRef = ref<{ handleOpen: (data: SupplierDialogOpenData) => Promise<void> }>()
  const detailRef = ref<{ handleOpen: (row: PurchaseSupplier) => Promise<void> }>()
  const groupDialogRef = ref<{ handleOpen: (data: GroupDialogOpenData) => Promise<void> }>()
  const groups = ref<MasterGroup[]>([])
  const groupsLoading = ref(false)
  const groupsError = ref('')
  const selectedGroupId = ref('')
  const total = ref(0)
  const search = reactive({ keyword: '', supplierCategory: '', supplierType: '' })
  const groupTree = new TreeUtils({ parentKey: 'parentId' })
  const groupIds = computed(() =>
    selectedGroupId.value
      ? groupTree
          .getDescendants(groupTree.listToTree(groups.value), selectedGroupId.value, true)
          .map((group) => String(group.id))
      : undefined
  )
  const tenantChoices = () =>
    tenantOptions.value.map((tenant) => ({
      label: `${tenant.tenantName || tenant.tenantCode}（${tenant.tenantCode}）`,
      value: tenant.id
    }))

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前供应商',
      value: total.value,
      description: selectedGroupId.value ? '当前分组及下级' : '当前租户范围',
      icon: 'ri:store-3-line'
    },
    {
      label: '分组节点',
      value: groups.value.length,
      description: '支持多级分类',
      icon: 'ri:node-tree'
    }
  ])

  const options = (code: string) =>
    (getDictMap.value[code] ?? []).map((item) => ({
      label: String(item.label || item.name || item.value || ''),
      value: String(item.value ?? '')
    }))
  const label = (code: string, value?: string | null) =>
    options(code).find((item) => item.value === value)?.label || value || '—'
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      key: 'keyword',
      label: '关键字',
      type: 'input',
      props: { clearable: true, placeholder: '编码、名称、联系人或地址' }
    },
    {
      key: 'supplierCategory',
      label: '供应商类别',
      type: 'select',
      props: { clearable: true, placeholder: '全部类别', options: options('supplierCategory') }
    },
    {
      key: 'supplierType',
      label: '供应商类型',
      type: 'select',
      props: { clearable: true, placeholder: '全部类型', options: options('supplierType') }
    }
  ])

  const openSupplier = (row?: PurchaseSupplier): void => {
    void supplierDialogRef.value?.handleOpen({
      row,
      tenantId: row?.tenantId || effectiveTenantId.value || '',
      tenantOptions: tenantChoices(),
      groups: groups.value,
      initialGroupId: row ? undefined : selectedGroupId.value || undefined
    })
  }
  const openDetail = (row: PurchaseSupplier): void => {
    void detailRef.value?.handleOpen(row)
  }

  const exportColumns: ArtTableQueryExcelColumn[] = [
    { key: 'supplierCode', title: '供应商编码', required: true },
    { key: 'supplierName', title: '供应商名称', required: true },
    { key: 'supplierCategory', title: '供应商类别' },
    { key: 'supplierGroup', title: '供应商分组' },
    { key: 'supplierType', title: '供应商类型' },
    { key: 'enterpriseNature', title: '企业性质' },
    { key: 'industry', title: '行业' },
    { key: 'contactPerson', title: '主要联系人' },
    { key: 'contactPhone', title: '联系电话' },
    { key: 'addressDetail', title: '详细地址' },
    { key: 'remark', title: '备注' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'MdmPurchaseSupplier:Add',
      type: 'add',
      label: '新增供应商',
      onClick: () => openSupplier()
    },
    {
      permission: 'MdmPurchaseSupplier:Export',
      type: 'export',
      exportFilename: '供应商主数据',
      exportSheetName: '供应商',
      exportColumns,
      exportApi: async ({ selectedIds, searchParams }) => {
        const query: Omit<SupplierQuery, 'current' | 'size'> = {
          ...searchParams,
          tenantId: effectiveTenantId.value,
          groupIds: groupIds.value?.slice(),
          ids: selectedIds.length ? selectedIds.map(String) : undefined
        }
        const rows = await loadAllDocumentPages<PurchaseSupplier, { from: number; to: number }>(
          async ({ from, to }) => {
            const size = to - from + 1
            const result = await fetchPurchaseSuppliers({
              ...query,
              current: from / size + 1,
              size
            })
            return { data: result.records, total: result.total }
          },
          { from: 0, to: 499 }
        )
        return {
          data: rows.map((row) => ({
            ...row,
            supplierCategory: label('supplierCategory', row.supplierCategory),
            supplierType: label('supplierType', row.supplierType),
            enterpriseNature: label('enterpriseNature', row.enterpriseNature),
            industry: label('supplierIndustry', row.industry),
            supplierGroup: groups.value.find((group) => group.id === row.groupId)?.name || '未分组'
          }))
        }
      }
    }
  ])
  const selectionActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'MdmPurchaseSupplier:Delete',
      type: 'delete',
      content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
        `确定删除选中的 ${selectedCount} 家供应商吗？`,
      onClick: async ({ selectedRows, api }) => {
        await deletePurchaseSuppliers(selectedRows.map((row) => String(row.id)))
        await api.refreshRemove()
      }
    }
  ])

  const columnsFactory = (): ColumnOption<PurchaseSupplier>[] => [
    { type: 'selection', width: 48, fixed: 'left' },
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'supplierName',
      label: '供应商',
      minWidth: 230,
      fixed: 'left',
      showOverflowTooltip: true,
      link: { permission: 'MdmPurchaseSupplier:View', onClick: openDetail },
      formatter: (row) => row.supplierName
    },
    { prop: 'supplierCode', label: '编码', minWidth: 135, showOverflowTooltip: true },
    {
      prop: 'groupId',
      label: '供应商分组',
      minWidth: 145,
      formatter: (row) => groups.value.find((group) => group.id === row.groupId)?.name || '未分组'
    },
    {
      prop: 'supplierCategory',
      label: '供应商类别',
      minWidth: 130,
      formatter: (row) => label('supplierCategory', row.supplierCategory)
    },
    {
      prop: 'supplierType',
      label: '供应商类型',
      minWidth: 120,
      formatter: (row) => label('supplierType', row.supplierType)
    },
    { prop: 'contactPerson', label: '主要联系人', minWidth: 120, showOverflowTooltip: true },
    { prop: 'contactPhone', label: '联系电话', minWidth: 145, showOverflowTooltip: true },
    { prop: 'addressDetail', label: '详细地址', minWidth: 230, showOverflowTooltip: true },
    {
      prop: 'updateTime',
      label: '更新时间',
      width: 164,
      formatter: (row) => dayjs(row.updateTime).format('YYYY-MM-DD HH:mm')
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
            permission="MdmPurchaseSupplier:View"
            onClick={() => openDetail(row)}
          />
          <ArtButtonTable
            type="edit"
            permission="MdmPurchaseSupplier:Edit"
            onClick={() => openSupplier(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="MdmPurchaseSupplier:Delete"
            onClick={() => void removeSupplier(row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  async function fetchRows(params: SupplierQuery, options?: { signal?: AbortSignal }) {
    const result = await fetchPurchaseSuppliers(
      {
        ...params,
        tenantId: effectiveTenantId.value,
        groupIds: groupIds.value
      },
      options?.signal
    )
    total.value = result.total
    return result
  }

  async function loadGroups(): Promise<void> {
    groupsLoading.value = true
    groupsError.value = ''
    try {
      groups.value = await fetchMasterGroups('supplier', effectiveTenantId.value)
    } catch {
      groupsError.value = '分组加载失败，请重试'
    } finally {
      groupsLoading.value = false
    }
  }
  function selectGroup(id: string): void {
    selectedGroupId.value = id
    void tableRef.value?.getData()
  }
  function groupOpenData(row?: MasterGroup, parent?: MasterGroup): GroupDialogOpenData {
    return {
      domain: 'supplier',
      tenantId: row?.tenantId || parent?.tenantId || effectiveTenantId.value || '',
      tenantOptions: tenantChoices(),
      groups: groups.value,
      row,
      parent
    }
  }
  function openGroupAdd(parent?: MasterGroup): void {
    void groupDialogRef.value?.handleOpen(groupOpenData(undefined, parent))
  }
  function openGroupEdit(row: MasterGroup): void {
    void groupDialogRef.value?.handleOpen(groupOpenData(row))
  }
  async function removeGroup(row: MasterGroup): Promise<void> {
    await confirmDelete(`确定删除分组“${row.name}”吗？`)
    await deleteMasterGroup(row.id)
    if (selectedGroupId.value === row.id) selectedGroupId.value = ''
    await refreshAfterGroupSave()
  }
  async function removeSupplier(row: PurchaseSupplier): Promise<void> {
    await confirmDelete(`确定删除供应商“${row.supplierName}”吗？`)
    await deletePurchaseSuppliers([row.id])
    await tableRef.value?.refreshRemove()
  }
  function refreshAfterSave(mode: 'add' | 'edit'): void {
    void (mode === 'add' ? tableRef.value?.refreshCreate() : tableRef.value?.refreshUpdate())
  }
  async function refreshAfterGroupSave(): Promise<void> {
    await loadGroups()
    await tableRef.value?.refreshData()
  }
  async function loadContext(): Promise<void> {
    selectedGroupId.value = ''
    await tenantScopeStore.loadTenantOptions()
    await Promise.all([
      loadGroups(),
      ...['supplierCategory', 'supplierType', 'enterpriseNature', 'supplierIndustry'].map((code) =>
        userStore.ensureDictLoaded(code)
      )
    ])
    await tableRef.value?.getData()
  }
  watch(effectiveTenantId, () => void loadContext(), { immediate: true })
</script>

<style scoped lang="scss">
  .purchase-supplier-page {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;

    &__workspace {
      display: grid;
      flex: 1;
      grid-template-columns: 276px minmax(0, 1fr);
      gap: 12px;
      min-width: 0;
      min-height: 0;
    }

    @media (width <= 1100px) {
      &__workspace {
        grid-template-columns: 230px minmax(0, 1fr);
      }
    }

    @media (width <= 760px) {
      &__workspace {
        grid-template-rows: minmax(220px, auto) minmax(480px, 1fr);
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
