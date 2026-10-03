<template>
  <div
    v-auth="'MdmGovernance:View'"
    class="art-full-height mdm-governance-center business-workspace-page"
  >
    <BusinessWorkspaceHeader
      :eyebrow="pageHeader.eyebrow"
      :title="pageHeader.title"
      :description="pageHeader.description"
      :icon="pageHeader.icon"
      :tags="[
        { label: '四眼审批', type: 'primary' },
        { label: '租户强隔离', type: 'success' },
        { label: '可追溯交付', type: 'info' }
      ]"
      :metrics="metrics"
      refreshable
      refresh-label="刷新治理控制面"
      :refresh-loading="overviewLoading"
      @metric-click="handleMetricClick"
      @refresh="refreshAll"
    >
      <template #actions>
        <div class="mdm-governance-center__actions">
          <BusinessTableWorkspaceActions :table="activeTable" />
          <ElButton
            v-auth="'MdmGovernance:RunQuality'"
            :loading="qualityScanning"
            @click="runQuality"
          >
            <ArtSvgIcon icon="ri:pulse-line" />质量检测
          </ElButton>
          <ElButton
            v-auth="'MdmGovernance:ManageMatch'"
            :loading="matchScanning"
            @click="runMatchScan"
          >
            <ArtSvgIcon icon="ri:links-line" />匹配扫描
          </ElButton>
          <ElButton
            v-auth="'MdmGovernance:CreateChange'"
            type="primary"
            @click="changeDialogRef?.handleOpen()"
          >
            <ArtSvgIcon icon="ri:add-line" />发起变更
          </ElButton>
        </div>
      </template>
    </BusinessWorkspaceHeader>

    <ArtSectionCard class="mdm-governance-center__workspace" preserve-content-structure>
      <template #header>
        <header class="mdm-governance-center__workspace-header">
          <div>
            <ArtSectionTitle :show-line="false">治理作业队列</ArtSectionTitle>
            <p>{{ activeTabDescription }}</p>
          </div>
          <div class="mdm-governance-center__config-actions">
            <ElButton v-auth="'MdmGovernance:AssignSteward'" plain @click="openConfig('steward')">
              <ArtSvgIcon icon="ri:user-star-line" />责任人
            </ElButton>
            <ElButton v-auth="'MdmGovernance:ManageRules'" plain @click="openConfig('rule')">
              <ArtSvgIcon icon="ri:verified-badge-line" />质量规则
            </ElButton>
            <ElButton
              v-auth="'MdmGovernance:ManageConsumers'"
              plain
              @click="openConfig('consumer')"
            >
              <ArtSvgIcon icon="ri:route-line" />消费者
            </ElButton>
          </div>
        </header>
      </template>

      <ElTabs v-model="activeTab" class="mdm-governance-center__tabs">
        <ElTabPane name="quality">
          <template #label>
            <span class="mdm-governance-center__tab-label">
              <ArtSvgIcon icon="ri:pulse-line" />质量问题
              <ElBadge :value="overview.openIssues" :max="99" />
            </span>
          </template>
          <ArtTableQuery
            ref="qualityTableRef"
            focusable
            v-model="qualityQuery"
            :search-items="qualitySearchItems"
            :api-fn="fetchMdmQualityIssues"
            :columns-factory="qualityColumns"
            :search-bar-props="searchBarProps"
            :table-props="qualityTableProps"
          />
        </ElTabPane>
        <ElTabPane name="changes">
          <template #label>
            <span class="mdm-governance-center__tab-label">
              <ArtSvgIcon icon="ri:git-pull-request-line" />主数据变更
              <ElBadge :value="overview.pendingChanges" :max="99" />
            </span>
          </template>
          <ArtTableQuery
            ref="changeTableRef"
            focusable
            v-model="changeQuery"
            :search-items="changeSearchItems"
            :api-fn="fetchMdmChangeRequests"
            :columns-factory="changeColumns"
            :search-bar-props="searchBarProps"
            :table-props="changeTableProps"
          />
        </ElTabPane>
        <ElTabPane name="matches">
          <template #label>
            <span class="mdm-governance-center__tab-label">
              <ArtSvgIcon icon="ri:node-tree" />黄金记录匹配
              <ElBadge :value="overview.pendingMatches" :max="99" />
            </span>
          </template>
          <ArtTableQuery
            ref="matchTableRef"
            focusable
            v-model="matchQuery"
            :search-items="matchSearchItems"
            :api-fn="fetchMdmMatchCandidates"
            :columns-factory="matchColumns"
            :search-bar-props="searchBarProps"
            :table-props="matchTableProps"
          />
        </ElTabPane>
        <ElTabPane name="outbox">
          <template #label>
            <span class="mdm-governance-center__tab-label">
              <ArtSvgIcon icon="ri:send-plane-2-line" />事件交付
              <ElBadge :value="overview.deadLetters" :max="99" type="danger" />
            </span>
          </template>
          <div v-if="overview.deadLetters" class="mdm-governance-center__dead-letter-alert">
            <ArtSvgIcon icon="ri:alarm-warning-line" />
            <span
              >存在
              {{ overview.deadLetters }} 条死信。请先核查下游故障原因，再填写依据进行重放。</span
            >
          </div>
          <ArtTableQuery
            ref="outboxTableRef"
            focusable
            v-model="outboxQuery"
            :search-items="outboxSearchItems"
            :api-fn="fetchMdmOutboxDeliveries"
            :columns-factory="outboxColumns"
            :search-bar-props="searchBarProps"
            :table-props="outboxTableProps"
          />
        </ElTabPane>
      </ElTabs>
    </ArtSectionCard>

    <MdmChangeRequestDialog ref="changeDialogRef" @success="handleChangeCreated" />
    <MdmGovernanceActionDialog ref="actionDialogRef" @success="handleActionSuccess" />
    <MdmGovernanceConfigDialog ref="configDialogRef" @success="handleConfigSuccess" />
  </div>
</template>

<script setup lang="tsx">
  import { ElMessage, ElTag } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchMdmChangeRequests,
    fetchMdmGovernanceOverview,
    fetchMdmMatchCandidates,
    fetchMdmOutboxDeliveries,
    fetchMdmQualityIssues,
    runMdmQualityScan,
    scanMdmBusinessPartnerMatches,
    type MdmChangeRequest,
    type MdmGovernanceOverview,
    type MdmMatchCandidate,
    type MdmOutboxDelivery,
    type MdmQualityIssue
  } from '@mdm/api'
  import MdmChangeRequestDialog from './modules/change-request-dialog.vue'
  import MdmGovernanceActionDialog from './modules/governance-action-dialog.vue'
  import MdmGovernanceConfigDialog from './modules/governance-config-dialog.vue'
  import {
    getGovernanceAggregateTypeLabel,
    getGovernanceChangeOperationLabel,
    getGovernanceEventTypeLabel,
    getGovernanceSourceCodeLabel,
    getGovernanceSourceTypeLabel
  } from './governance-labels'

  defineOptions({ name: 'MdmGovernanceCenter' })

  type ActiveTab = 'quality' | 'changes' | 'matches' | 'outbox'
  const props = withDefaults(defineProps<{ initialView?: ActiveTab }>(), {
    initialView: 'quality'
  })
  type ConfigKind = 'steward' | 'rule' | 'consumer'
  interface ChangeDialogExpose {
    handleOpen: () => Promise<void>
  }
  interface ConfigDialogExpose {
    handleOpen: (kind: ConfigKind) => Promise<void>
  }
  interface ActionDialogExpose {
    handleOpen: (context: Record<string, unknown>) => Promise<void>
  }

  const activeTab = ref<ActiveTab>(props.initialView)
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const dictOptions = (code: string) =>
    (getDictMap.value[code] ?? []).map((item) => ({
      label: item.label ?? item.value,
      value: item.value
    }))
  void Promise.all(
    [
      'mdmGovernanceQualityIssueStatus',
      'mdmGovernanceChangeStatus',
      'mdmGovernanceMatchStatus',
      'mdmGovernanceOutboxStatus',
      'mdmGovernanceSeverity'
    ].map((code) => userStore.ensureDictLoaded(code))
  )
  const pageHeaders: Record<
    ActiveTab,
    { eyebrow: string; title: string; description: string; icon: string }
  > = {
    quality: {
      eyebrow: 'DATA QUALITY',
      title: '数据质量管理',
      description: '集中发现、分派、整改和独立复核主数据质量问题，持续跟踪规则命中与 SLA。',
      icon: 'ri:pulse-line'
    },
    changes: {
      eyebrow: 'CHANGE CONTROL',
      title: '主数据变更管理',
      description: '统一处理主数据变更申请、异人审核、计划生效和发布记录。',
      icon: 'ri:git-pull-request-line'
    },
    matches: {
      eyebrow: 'GOLDEN RECORD',
      title: '黄金记录管理',
      description: '评审重复候选，形成可信黄金身份，并保留来源映射与人工决策依据。',
      icon: 'ri:node-tree'
    },
    outbox: {
      eyebrow: 'DATA DISTRIBUTION',
      title: '数据分发管理',
      description: '监控主数据事件交付、消费者状态、失败重试和死信恢复。',
      icon: 'ri:send-plane-2-line'
    }
  }
  const pageHeader = computed(() => pageHeaders[activeTab.value])
  const overviewLoading = ref(false)
  const qualityScanning = ref(false)
  const matchScanning = ref(false)
  const overview = reactive<MdmGovernanceOverview>({
    stewards: 0,
    activeRules: 0,
    openIssues: 0,
    overdueIssues: 0,
    pendingChanges: 0,
    pendingMatches: 0,
    pendingDeliveries: 0,
    deadLetters: 0,
    generatedAt: new Date(0).toISOString()
  })
  const qualityTableRef = ref<ArtTableQueryExpose>()
  const changeTableRef = ref<ArtTableQueryExpose>()
  const matchTableRef = ref<ArtTableQueryExpose>()
  const outboxTableRef = ref<ArtTableQueryExpose>()
  const activeTable = computed(
    () =>
      ({
        quality: qualityTableRef.value,
        changes: changeTableRef.value,
        matches: matchTableRef.value,
        outbox: outboxTableRef.value
      })[activeTab.value]
  )
  const changeDialogRef = ref<ChangeDialogExpose>()
  const configDialogRef = ref<ConfigDialogExpose>()
  const actionDialogRef = ref<ActionDialogExpose>()

  const searchBarProps = { span: 8, labelWidth: 84 }
  const qualityTableProps = {
    rowKey: 'id',
    tableLayout: 'fixed' as const,
    emptyText: '当前没有质量问题',
    emptyDescription: '可以执行质量检测，或调整筛选条件查看已闭环记录。'
  }
  const changeTableProps = {
    rowKey: 'id',
    tableLayout: 'fixed' as const,
    emptyText: '当前没有主数据变更申请',
    emptyDescription: '有权限的用户可以从页面右上角发起受控变更。'
  }
  const matchTableProps = {
    rowKey: 'id',
    tableLayout: 'fixed' as const,
    emptyText: '当前没有候选匹配',
    emptyDescription: '匹配扫描只生成候选项，不会自动合并来源主档。'
  }
  const outboxTableProps = {
    rowKey: 'id',
    tableLayout: 'fixed' as const,
    emptyText: '当前没有事件投递记录',
    emptyDescription: '配置下游消费者后，新治理事件将创建独立投递任务。'
  }

  const qualityQuery = reactive({
    current: 1,
    size: 20,
    keyword: '',
    state: '',
    severity: '' as const
  })
  const changeQuery = reactive({ current: 1, size: 20, keyword: '', state: '' })
  const matchQuery = reactive({ current: 1, size: 20, keyword: '', state: 'pending' })
  const outboxQuery = reactive({ current: 1, size: 20, keyword: '', state: '' })

  const stateSearch = (options: { label: string; value: string }[]): SearchFormItem => ({
    label: '状态',
    key: 'state',
    type: 'select',
    props: { options, clearable: true, placeholder: '全部状态' }
  })
  const qualitySearchItems = computed<SearchFormItem[]>(() => [
    {
      label: '主档',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '搜索编码或名称' }
    },
    stateSearch(dictOptions('mdmGovernanceQualityIssueStatus')),
    {
      label: '严重级别',
      key: 'severity',
      type: 'select',
      props: {
        clearable: true,
        options: dictOptions('mdmGovernanceSeverity')
      }
    }
  ])
  const changeSearchItems = computed<SearchFormItem[]>(() => [
    {
      label: '申请',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '编号、标题或申请人' }
    },
    stateSearch(dictOptions('mdmGovernanceChangeStatus'))
  ])
  const matchSearchItems = computed<SearchFormItem[]>(() => [
    {
      label: '来源记录',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '输入完整 UUID' }
    },
    stateSearch(dictOptions('mdmGovernanceMatchStatus'))
  ])
  const outboxSearchItems = computed<SearchFormItem[]>(() => [
    stateSearch(dictOptions('mdmGovernanceOutboxStatus'))
  ])

  const activeTabDescription = computed(
    () =>
      ({
        quality: '质量问题按规则、责任人和 SLA 进入整改与独立复核闭环。',
        changes: '主数据写入经过草稿、提交、异人审核、计划生效与发布全过程。',
        matches: '匹配引擎只推荐候选；人工选择胜出记录后生成黄金身份和来源映射。',
        outbox: '每个消费者拥有独立状态、重试次数和死信恢复轨迹。'
      })[activeTab.value]
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      key: 'quality',
      label: '开放质量问题',
      value: overview.openIssues,
      description: overview.overdueIssues
        ? `${overview.overdueIssues} 条已超 SLA`
        : '当前无逾期问题',
      icon: 'ri:pulse-line',
      tone: overview.overdueIssues ? 'warning' : 'success',
      loading: overviewLoading.value
    },
    {
      key: 'changes',
      label: '待处理变更',
      value: overview.pendingChanges,
      description: '含待审核与待发布',
      icon: 'ri:git-pull-request-line',
      tone: 'primary',
      loading: overviewLoading.value
    },
    {
      key: 'matches',
      label: '待评审匹配',
      value: overview.pendingMatches,
      description: '禁止自动合并',
      icon: 'ri:links-line',
      tone: 'primary',
      loading: overviewLoading.value
    },
    {
      key: 'outbox',
      label: '异常事件交付',
      value: overview.deadLetters,
      description: `${overview.pendingDeliveries} 条正在交付`,
      icon: 'ri:send-plane-2-line',
      tone: overview.deadLetters ? 'danger' : 'success',
      loading: overviewLoading.value
    }
  ])

  const stateLabels: Record<string, string> = {
    open: '待处理',
    in_progress: '整改中',
    pending_verification: '待复核',
    resolved: '已解决',
    waived: '已豁免',
    reopened: '重新打开',
    draft: '草稿',
    submitted: '待审核',
    approved: '已通过',
    rejected: '已驳回',
    published: '已发布',
    cancelled: '已撤回',
    pending: '待处理',
    accepted: '已接受',
    superseded: '已取代',
    processing: '处理中',
    retry: '等待重试',
    delivered: '已送达',
    dead_letter: '死信'
  }
  const statusType = (state: string) => {
    if (['resolved', 'published', 'accepted', 'delivered'].includes(state)) return 'success'
    if (['rejected', 'dead_letter'].includes(state)) return 'danger'
    if (['in_progress', 'submitted', 'processing'].includes(state)) return 'primary'
    if (['waived', 'reopened', 'approved', 'retry', 'pending_verification'].includes(state))
      return 'warning'
    return 'info'
  }
  const formatDate = createDateTimeFormatter({ emptyText: '—' })
  const statusCell = (state: string) => (
    <ElTag type={statusType(state)} effect="light">
      {stateLabels[state] || state}
    </ElTag>
  )
  const severityCell = (severity: string) => (
    <ElTag
      type={severity === 'critical' ? 'danger' : severity === 'high' ? 'warning' : 'info'}
      effect="plain"
    >
      {{ low: '低', medium: '中', high: '高', critical: '关键' }[severity] || severity}
    </ElTag>
  )

  const qualityActions = (row: MdmQualityIssue): ButtonMoreItem[] => {
    const actions: ButtonMoreItem[] = []
    if (['open', 'reopened'].includes(row.state))
      actions.push({
        key: 'start',
        label: '开始整改',
        icon: 'ri:play-circle-line',
        auth: 'MdmGovernance:ResolveIssue'
      })
    if (row.state === 'in_progress')
      actions.push({
        key: 'submit_resolution',
        label: '提交整改结果',
        icon: 'ri:send-plane-line',
        auth: 'MdmGovernance:ResolveIssue'
      })
    if (row.state === 'pending_verification')
      actions.push({
        key: 'verify',
        label: '独立复核通过',
        icon: 'ri:check-double-line',
        auth: 'MdmGovernance:ResolveIssue'
      })
    if (['open', 'in_progress', 'reopened'].includes(row.state))
      actions.push({
        key: 'waive',
        label: '豁免问题',
        icon: 'ri:alarm-warning-line',
        auth: 'MdmGovernance:ResolveIssue'
      })
    if (['resolved', 'waived', 'pending_verification'].includes(row.state))
      actions.push({
        key: 'reopen',
        label: '重新打开',
        icon: 'ri:restart-line',
        auth: 'MdmGovernance:ResolveIssue'
      })
    return actions
  }
  const changeActions = (row: MdmChangeRequest): ButtonMoreItem[] => {
    const actions: ButtonMoreItem[] = []
    if (row.state === 'draft')
      actions.push({
        key: 'submit',
        label: '提交审核',
        icon: 'ri:send-plane-line',
        auth: 'MdmGovernance:SubmitChange'
      })
    if (['draft', 'submitted'].includes(row.state))
      actions.push({
        key: 'cancel',
        label: '撤回申请',
        icon: 'ri:arrow-go-back-line',
        auth: 'MdmGovernance:SubmitChange'
      })
    if (row.state === 'submitted') {
      actions.push({
        key: 'approve',
        label: '审核通过',
        icon: 'ri:check-double-line',
        auth: 'MdmGovernance:ReviewChange'
      })
      actions.push({
        key: 'reject',
        label: '驳回申请',
        icon: 'ri:close-circle-line',
        auth: 'MdmGovernance:ReviewChange'
      })
    }
    if (row.state === 'approved')
      actions.push({
        key: 'publish',
        label: '发布变更',
        icon: 'ri:broadcast-line',
        auth: 'MdmGovernance:PublishChange',
        disabled: new Date(row.effectiveAt).getTime() > Date.now()
      })
    return actions
  }

  const qualityColumns = (): ColumnOption<MdmQualityIssue>[] => [
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'sourceName',
      label: '问题主档',
      minWidth: 220,
      formatter: (row) => (
        <div class="governance-identity">
          <strong>{row.sourceName}</strong>
          <small>
            {getGovernanceSourceCodeLabel(row.sourceType, row.sourceRecordId, row.sourceCode)}
          </small>
        </div>
      )
    },
    {
      prop: 'sourceType',
      label: '主档类型',
      minWidth: 140,
      formatter: (row) => getGovernanceSourceTypeLabel(row.sourceType)
    },
    { prop: 'severity', label: '级别', width: 88, formatter: (row) => severityCell(row.severity) },
    { prop: 'state', label: '状态', width: 112, formatter: (row) => statusCell(row.state) },
    {
      prop: 'dueAt',
      label: 'SLA 截止',
      width: 168,
      formatter: (row) => (
        <span
          class={{
            'is-overdue':
              new Date(row.dueAt).getTime() < Date.now() &&
              !['resolved', 'waived'].includes(row.state)
          }}
        >
          {formatDate(row.dueAt)}
        </span>
      )
    },
    { prop: 'detectionCount', label: '命中次数', width: 92 },
    {
      prop: 'operation',
      label: '操作',
      width: 78,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonMore
          list={qualityActions(row)}
          onClick={(item) => openQualityAction(row, String(item.key))}
        />
      )
    }
  ]
  const changeColumns = (): ColumnOption<MdmChangeRequest>[] => [
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'title',
      label: '变更申请',
      minWidth: 250,
      formatter: (row) => (
        <div class="governance-identity">
          <strong>{row.title}</strong>
          <small>
            {row.requestNo} · v{row.version}
          </small>
        </div>
      )
    },
    {
      prop: 'sourceType',
      label: '主档类型',
      minWidth: 130,
      formatter: (row) => getGovernanceSourceTypeLabel(row.sourceType)
    },
    {
      prop: 'operation',
      label: '动作',
      width: 90,
      formatter: (row) => getGovernanceChangeOperationLabel(row.operation)
    },
    { prop: 'state', label: '状态', width: 105, formatter: (row) => statusCell(row.state) },
    { prop: 'requesterEmail', label: '申请人', minWidth: 180 },
    {
      prop: 'effectiveAt',
      label: '计划生效',
      width: 168,
      formatter: (row) => formatDate(row.effectiveAt)
    },
    {
      prop: 'operationMenu',
      label: '操作',
      width: 78,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonMore
          list={changeActions(row)}
          onClick={(item) => openChangeAction(row, String(item.key))}
        />
      )
    }
  ]
  const matchColumns = (): ColumnOption<MdmMatchCandidate>[] => [
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'sourceType',
      label: '主档类型',
      minWidth: 130,
      formatter: (row) => getGovernanceSourceTypeLabel(row.sourceType)
    },
    { prop: 'leftRecordId', label: '左侧来源记录', minWidth: 220 },
    { prop: 'rightRecordId', label: '右侧来源记录', minWidth: 220 },
    {
      prop: 'matchScore',
      label: '置信度',
      width: 105,
      formatter: (row) => <strong>{Math.round(row.matchScore * 100)}%</strong>
    },
    { prop: 'state', label: '状态', width: 105, formatter: (row) => statusCell(row.state) },
    {
      prop: 'createTime',
      label: '发现时间',
      width: 168,
      formatter: (row) => formatDate(row.createTime)
    },
    {
      prop: 'operation',
      label: '操作',
      width: 78,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonMore
          list={
            row.state === 'pending'
              ? [
                  {
                    key: 'accept',
                    label: '接受并生成黄金记录',
                    icon: 'ri:links-line',
                    auth: 'MdmGovernance:MergeRecord'
                  },
                  {
                    key: 'reject',
                    label: '驳回候选',
                    icon: 'ri:link-unlink-m',
                    auth: 'MdmGovernance:ManageMatch'
                  }
                ]
              : []
          }
          onClick={(item) => openMatchAction(row, String(item.key))}
        />
      )
    }
  ]
  const outboxColumns = (): ColumnOption<MdmOutboxDelivery>[] => [
    { type: 'globalIndex', label: '序号', width: 66 },
    {
      prop: 'event',
      label: '事件',
      minWidth: 250,
      formatter: (row) => (
        <div class="governance-identity">
          <strong>{getGovernanceEventTypeLabel(row.event?.eventType)}</strong>
          <small>
            {getGovernanceAggregateTypeLabel(row.event?.aggregateType)} · 版本
            {row.event?.eventVersion || 1}
          </small>
        </div>
      )
    },
    {
      prop: 'consumer',
      label: '消费者',
      minWidth: 180,
      formatter: (row) => row.consumer?.consumerName || row.consumerId
    },
    { prop: 'status', label: '状态', width: 110, formatter: (row) => statusCell(row.status) },
    { prop: 'attempts', label: '尝试次数', width: 96 },
    {
      prop: 'availableAt',
      label: '下次可用',
      width: 168,
      formatter: (row) => formatDate(row.availableAt)
    },
    {
      prop: 'lastError',
      label: '最近错误',
      minWidth: 220,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.lastError
          ? getFriendlySupabaseErrorMessage(row.lastError, '事件分发失败，请核查消费者配置后重试')
          : '—'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 78,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonMore
          list={
            row.status === 'dead_letter'
              ? [
                  {
                    key: 'replay',
                    label: '核查后重放',
                    icon: 'ri:restart-line',
                    auth: 'MdmGovernance:ReplayEvent'
                  }
                ]
              : []
          }
          onClick={() =>
            actionDialogRef.value?.handleOpen({ kind: 'replay', action: 'replay', row })
          }
        />
      )
    }
  ]

  async function loadOverview(): Promise<void> {
    if (overviewLoading.value) return
    overviewLoading.value = true
    try {
      Object.assign(overview, await fetchMdmGovernanceOverview())
    } finally {
      overviewLoading.value = false
    }
  }
  async function refreshAll(): Promise<void> {
    await Promise.all([
      loadOverview(),
      qualityTableRef.value?.refreshData(),
      changeTableRef.value?.refreshData(),
      matchTableRef.value?.refreshData(),
      outboxTableRef.value?.refreshData()
    ])
  }
  async function runQuality(): Promise<void> {
    qualityScanning.value = true
    try {
      const result = await runMdmQualityScan()
      ElMessage.success(`质量检测完成：新增 ${result.opened} 条，重新打开 ${result.reopened} 条`)
      await Promise.all([loadOverview(), qualityTableRef.value?.refreshData()])
    } finally {
      qualityScanning.value = false
    }
  }
  async function runMatchScan(): Promise<void> {
    matchScanning.value = true
    try {
      const result = await scanMdmBusinessPartnerMatches()
      ElMessage.success(`匹配扫描完成：新增 ${result.created} 个候选项`)
      await Promise.all([loadOverview(), matchTableRef.value?.refreshData()])
    } finally {
      matchScanning.value = false
    }
  }
  function openConfig(kind: ConfigKind): void {
    void configDialogRef.value?.handleOpen(kind)
  }
  function openQualityAction(row: MdmQualityIssue, action: string): void {
    void actionDialogRef.value?.handleOpen({ kind: 'quality', action, row })
  }
  function openChangeAction(row: MdmChangeRequest, action: string): void {
    void actionDialogRef.value?.handleOpen({ kind: 'change', action, row })
  }
  function openMatchAction(row: MdmMatchCandidate, action: string): void {
    void actionDialogRef.value?.handleOpen({ kind: 'match', action, row })
  }
  async function handleChangeCreated(): Promise<void> {
    await Promise.all([loadOverview(), changeTableRef.value?.refreshCreate()])
  }
  async function handleActionSuccess(): Promise<void> {
    await Promise.all([
      loadOverview(),
      qualityTableRef.value?.refreshData(),
      changeTableRef.value?.refreshData(),
      matchTableRef.value?.refreshData(),
      outboxTableRef.value?.refreshData()
    ])
  }
  async function handleConfigSuccess(): Promise<void> {
    await loadOverview()
  }
  function handleMetricClick(metric: BusinessWorkspaceMetric): void {
    if (metric.key && ['quality', 'changes', 'matches', 'outbox'].includes(String(metric.key)))
      activeTab.value = metric.key as ActiveTab
  }

  watch(
    () => props.initialView,
    (view) => {
      activeTab.value = view
    }
  )
  onMounted(() => void loadOverview())
</script>

<style scoped lang="scss">
  .mdm-governance-center {
    min-height: 0;
    overflow: hidden;

    &__actions,
    &__config-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    &__workspace {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    &__workspace-header {
      display: flex;
      gap: 16px;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-width: 0;

      p {
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__tabs {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;

      :deep(.el-tabs__header) {
        flex: 0 0 auto;
      }

      :deep(.el-tabs__content) {
        display: flex;
        flex: 1;
        min-height: 0;
      }

      :deep(.el-tab-pane) {
        flex: 1;
        min-width: 0;
        min-height: 0;
      }

      :deep(.art-table-query) {
        height: 100%;
      }
    }

    &__tab-label {
      display: inline-flex;
      gap: 7px;
      align-items: center;
    }

    &__dead-letter-alert {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 11px;
      color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
      border: 1px solid var(--el-color-danger-light-7);
      border-radius: var(--el-border-radius-base);
    }
  }

  :deep(.governance-identity) {
    display: grid;
    gap: 3px;
    min-width: 0;

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      font-size: 12px;
    }

    small {
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }
  }

  :deep(.is-overdue) {
    font-weight: 650;
    color: var(--el-color-danger);
  }

  @media (width <= 720px) {
    .mdm-governance-center {
      overflow: visible;

      &__workspace-header {
        flex-direction: column;
        align-items: flex-start;
      }

      &__config-actions {
        width: 100%;
      }

      &__config-actions :deep(.el-button) {
        flex: 1;
        margin-left: 0;
      }

      &__actions :deep(.el-button) {
        margin-left: 0;
      }
    }
  }
</style>
