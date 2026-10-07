<template>
  <div class="mdm-catalog-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      class="mdm-catalog-page__overview"
      eyebrow="MASTER DATA GOVERNANCE"
      :title="pageMeta.title"
      :description="pageMeta.description"
      :icon="pageMeta.icon"
      :tags="[
        { label: '统一治理视图', type: 'primary', effect: 'plain' },
        { label: '按来源分类', type: 'success', effect: 'light' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <div class="mdm-catalog-page__workspace">
      <ArtWorkspaceSplitter
        primary-size="252px"
        primary-min="220px"
        primary-max="360px"
        :breakpoint="800"
        stacked-primary-size="220px"
      >
        <template #primary
          ><CatalogSourceNavigator
            :sources="mdmCatalogSourceDefinitions[pageMeta.scope]"
            :selected="searchQuery.sourceType"
            @select="selectSource"
        /></template>
        <ArtTableQuery
          ref="tableQueryRef"
          v-model="searchQuery"
          :search-items="searchItems"
          :api-fn="fetchTableData"
          :columns-factory="columnsFactory"
          :search-bar-props="{ span: 8, labelWidth: 78, isExpand: true, showExpand: false }"
          :table-props="tableProps"
          :on-success="handleTableSuccess"
          :enable-cache="false"
          :on-error="() => (summaryUnavailable = true)"
          focusable
          focus-scope-selector=".mdm-catalog-page__workspace"
        />
      </ArtWorkspaceSplitter>
    </div>

    <CatalogDetailDrawer ref="detailDrawerRef" />
  </div>
</template>

<script setup lang="tsx">
  import { computed, ref, type ComputedRef } from 'vue'
  import { useRoute } from 'vue-router'
  import CatalogSourceNavigator from './modules/catalog-source-navigator.vue'
  import { ElProgress } from 'element-plus'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryProps,
    ArtTableQueryTableProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    fetchMdmCatalogPage,
    mdmCatalogSourceDefinitions,
    type MdmCatalogPageResponse,
    type MdmCatalogQuality,
    type MdmCatalogRecord,
    type MdmCatalogScope,
    type MdmCatalogState,
    type MdmCatalogSummary
  } from '@mdm/api'
  import CatalogDetailDrawer from './modules/catalog-detail-drawer.vue'

  defineOptions({ name: 'MdmCatalog' })

  interface CatalogPageMeta {
    scope: MdmCatalogScope
    title: string
    description: string
    searchHint: string
    icon: string
  }

  interface CatalogSearchParams {
    keyword: string
    sourceType?: string
    state?: MdmCatalogState
    quality?: MdmCatalogQuality
  }

  type TableParams = CatalogSearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface CatalogDetailDrawerExpose {
    handleOpen: (row: MdmCatalogRecord) => Promise<void>
  }

  const route = useRoute()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const detailDrawerRef = ref<CatalogDetailDrawerExpose>()
  const emptySummary = (): MdmCatalogSummary => ({
    total: 0,
    active: 0,
    inactive: 0,
    complete: 0,
    attention: 0,
    averageScore: 0
  })
  const summary = ref<MdmCatalogSummary>(emptySummary())
  const resultTotal = ref(0)
  const summaryLoading = ref(false)
  const summaryUnavailable = ref(false)

  const routeCatalog: Record<string, CatalogPageMeta> = {
    'organization-directory': {
      scope: 'organization',
      title: '组织机构主数据',
      description: '统一核对组织编码、层级身份、启停状态及权威来源。',
      searchHint: '组织编码或名称',
      icon: 'ri:organization-chart'
    },
    'position-directory': {
      scope: 'position',
      title: '岗位与职务主数据',
      description: '聚合职族、职级、职务与岗位，形成一致的人岗语义。',
      searchHint: '职族、职级、职务或岗位',
      icon: 'ri:briefcase-4-line'
    },
    'employee-directory': {
      scope: 'employee',
      title: '员工身份主数据',
      description: '以最小必要字段核对员工身份、任职归属与生效期间。',
      searchHint: '员工编号或姓名',
      icon: 'ri:contacts-book-3-line'
    },
    'business-partner-directory': {
      scope: 'partner',
      title: '统一往来主体',
      description: '贯通客户、承运商、供应商和服务商的外部主体身份。',
      searchHint: '主体编码或名称',
      icon: 'ri:building-4-line'
    },
    'logistics-directory': {
      scope: 'logistics',
      title: '物流基础主数据',
      description: '集中治理站点、客户地址、货物与司机等运输基础身份。',
      searchHint: '站点、客户地址、货物或司机',
      icon: 'ri:route-line'
    },
    'vehicle-directory': {
      scope: 'vehicle',
      title: '车辆主数据',
      description: '跨业务域统一识别车辆档案、运营状态与归属信息。',
      searchHint: '车牌号或车辆信息',
      icon: 'ri:truck-line'
    },
    'equipment-directory': {
      scope: 'equipment',
      title: '设备与备件主数据',
      description: '统一查看设备、备件及分类编码，识别资料完整度。',
      searchHint: '设备、备件或分类',
      icon: 'ri:tools-line'
    },
    'material-directory': {
      scope: 'material',
      title: '物料与场所主数据',
      description: '集中治理物料、分类、场所和存放位置的标准目录。',
      searchHint: '物料、场所或位置',
      icon: 'ri:archive-stack-line'
    }
  }

  // The page shell caches each route path separately; retain this instance's catalog context.
  const pageKey = String(route.path.split('/').filter(Boolean).at(-1) ?? '')
  const pageMeta = computed(
    () => routeCatalog[pageKey] ?? routeCatalog['business-partner-directory']
  )

  const searchQuery = ref<CatalogSearchParams>({ keyword: '' })

  const searchItems: ComputedRef<SearchFormItem[]> = computed(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: pageMeta.value.searchHint }
    },
    {
      label: '生命周期',
      key: 'state',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部状态',
        options: getDictMap.value.mdmCatalogStatus ?? []
      }
    },
    {
      label: '资料质量',
      key: 'quality',
      type: 'select',
      props: {
        clearable: true,
        placeholder: '全部质量',
        options: getDictMap.value.mdmCatalogQuality ?? []
      }
    }
  ])
  void Promise.all(
    ['mdmCatalogStatus', 'mdmCatalogQuality'].map((code) => userStore.ensureDictLoaded(code))
  )

  async function selectSource(sourceType: string | undefined) {
    searchQuery.value.sourceType = sourceType
    await tableQueryRef.value?.refreshContext()
  }

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前结果',
      value: summaryUnavailable.value ? '—' : resultTotal.value,
      loading: summaryLoading.value,
      description: summaryUnavailable.value ? '查询失败，请重试' : '随查询条件实时更新',
      icon: 'ri:database-2-line'
    },
    {
      label: '有效主档',
      value: summaryUnavailable.value ? '—' : summary.value.active,
      loading: summaryLoading.value,
      description: summaryUnavailable.value
        ? '统计暂不可用'
        : `本目录另有 ${summary.value.inactive} 条停用`,
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '平均完整度',
      value: summaryUnavailable.value ? '—' : `${summary.value.averageScore}%`,
      loading: summaryLoading.value,
      description: summaryUnavailable.value
        ? '统计暂不可用'
        : `${summary.value.attention} 条资料待完善`,
      icon: 'ri:shield-check-line',
      tone: summary.value.attention ? 'warning' : 'success'
    }
  ])

  const tableProps: ArtTableQueryTableProps = {
    rowKey: (row: MdmCatalogRecord) => `${row.sourceType}:${row.id}`,
    tableLayout: 'fixed',
    emptyText: '暂无符合条件的主数据',
    emptyDescription: '可调整关键字、主档类型、生命周期或资料完整度后重新查询。'
  }

  const fetchTableData = async (
    params: TableParams,
    options?: { signal?: AbortSignal }
  ): Promise<MdmCatalogPageResponse> => {
    summaryLoading.value = true
    try {
      const result = await fetchMdmCatalogPage(
        pageMeta.value.scope,
        {
          ...params,
          sourceType: searchQuery.value.sourceType
        },
        options
      )
      if (!options?.signal?.aborted) {
        summary.value = result.summary
        resultTotal.value = result.total
      }
      return result
    } finally {
      summaryLoading.value = false
    }
  }

  const sourceAppLabel = (value: string): string => {
    const labels: Record<string, string> = {
      platform: '平台',
      hr: 'HR',
      tms: 'TMS',
      vms: 'VMS',
      smis: 'SMIS'
    }
    return labels[value] ?? value.toUpperCase()
  }

  const formatDateTime = (value: string | null): string => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
  }

  const renderSource = (row: MdmCatalogRecord) => (
    <div class="mdm-source-cell">
      <span class="mdm-source-cell__icon">
        <ArtSvgIcon icon="ri:database-2-line" />
      </span>
      <div>
        <strong>{row.sourceLabel}</strong>
        <small>{sourceAppLabel(row.sourceApp)} 权威来源</small>
      </div>
    </div>
  )

  const renderIdentity = (row: MdmCatalogRecord) => (
    <div class="mdm-identity-cell">
      <strong title={row.name}>{row.name}</strong>
      <span title={row.code}>{row.code}</span>
      {row.subtitle ? <small title={row.subtitle}>{row.subtitle}</small> : null}
    </div>
  )

  const renderLifecycle = (row: MdmCatalogRecord) => (
    <ArtDictDisplay dictCode="mdmCatalogStatus" value={row.isActive ? 'active' : 'inactive'} />
  )

  const renderQuality = (row: MdmCatalogRecord) => (
    <div class="mdm-quality-cell">
      <ElProgress
        percentage={row.qualityScore}
        stroke-width={5}
        show-text={false}
        status={row.qualityScore >= 90 ? 'success' : 'warning'}
      />
      <span>{row.qualityScore}%</span>
      <small>{row.qualityIssues.length ? `${row.qualityIssues.length} 项待补` : '资料完整'}</small>
    </div>
  )

  const columnsFactory = (): ColumnOption<MdmCatalogRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'name',
      label: '主数据身份',
      minWidth: 240,
      formatter: renderIdentity,
      link: { onClick: (row) => detailDrawerRef.value?.handleOpen(row) }
    },
    { prop: 'sourceLabel', label: '主档来源', minWidth: 150, formatter: renderSource },
    { prop: 'status', label: '生命周期', width: 112, formatter: renderLifecycle },
    { prop: 'qualityScore', label: '资料完整度', minWidth: 190, formatter: renderQuality },
    {
      prop: 'updateTime',
      label: '最近更新',
      width: 174,
      formatter: (row) => <span class="mdm-time-cell">{formatDateTime(row.updateTime)}</span>
    },
    {
      prop: 'operation',
      label: '操作',
      width: 88,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          label="查看详情"
          onClick={() => detailDrawerRef.value?.handleOpen(row)}
        />
      )
    }
  ]

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (_rows, response) => {
    summaryUnavailable.value = false
    if (response.summary) summary.value = response.summary as MdmCatalogSummary
    resultTotal.value = Number(response.total ?? 0)
  }
</script>

<style scoped lang="scss">
  .mdm-catalog-page {
    min-height: 0;
    overflow: hidden;

    &__workspace {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
  }

  :deep(.mdm-source-cell),
  :deep(.mdm-identity-cell) {
    min-width: 0;
  }

  :deep(.mdm-source-cell) {
    display: flex;
    gap: 10px;
    align-items: center;

    div {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    strong {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 13px;
      color: var(--el-text-color-primary);
      white-space: nowrap;
    }

    small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  :deep(.mdm-source-cell__icon) {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 30px;
    height: 30px;
    color: var(--el-color-primary);
    background: color-mix(in srgb, var(--theme-color) 9%, var(--el-bg-color));
    border-radius: var(--el-border-radius-base);
  }

  :deep(.mdm-identity-cell) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 3px 12px;
    align-items: center;
    line-height: 1.5;

    strong,
    span,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 14px;
      color: var(--el-text-color-primary);
    }

    span {
      font-size: 12px;
      color: var(--el-color-primary);
    }

    small {
      grid-column: 1 / -1;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  :deep(.mdm-quality-cell) {
    display: grid;
    grid-template-columns: minmax(54px, 1fr) 38px;
    gap: 2px 8px;
    align-items: center;

    .el-progress {
      min-width: 0;
    }

    > span {
      font-size: 12px;
      font-weight: 650;
      color: var(--el-text-color-primary);
      text-align: right;
    }

    > small {
      grid-column: 1 / -1;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  :deep(.mdm-time-cell) {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 800px) {
    .mdm-catalog-page {
      height: auto;
      overflow: visible;

      &__workspace {
        flex: none;
      }
    }
  }
</style>
