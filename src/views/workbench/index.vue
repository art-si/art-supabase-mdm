<template>
  <div class="mdm-workbench business-workspace-page">
    <BusinessWorkspaceHeader
      eyebrow="MASTER DATA GOVERNANCE"
      title="治理总览"
      description="查看各业务域的主档规模与资料完整度，快速定位需要补充的数据。"
      icon="ri:database-2-line"
      :tags="[
        { label: '统一目录', type: 'primary' },
        { label: '租户隔离', type: 'success' },
        { label: '受控治理', type: 'info' }
      ]"
      :metrics="metrics"
      refreshable
      refresh-label="刷新主数据概览"
      :refresh-loading="loading"
      @refresh="loadOverview"
    />

    <div class="mdm-workbench__content">
      <ArtSectionCard
        class="mdm-workbench__directory"
        title="治理域目录"
        subtitle="按业务语义进入统一主档；记录维护仍在数据来源系统完成。"
        :loading="loading"
        :error="errorMessage"
        error-title="主数据概览加载失败"
        retryable
        @retry="loadOverview"
        :empty="!loading && !domains.length && !errorMessage"
        empty-title="当前租户暂无可查看的主数据"
        empty-description="请检查主数据权限，或在来源系统建立业务记录。"
        preserve-content-structure
      >
        <template #actions
          ><ElTag effect="plain" round>{{ domains.length }} 个治理域</ElTag></template
        >
        <div class="domain-list">
          <button
            v-for="(domain, index) in domains"
            :key="domain.key"
            type="button"
            @click="openDomain(domain.key)"
          >
            <span class="domain-list__index">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="domain-list__icon"><ArtSvgIcon :icon="domain.icon" /></span>
            <span class="domain-list__copy"
              ><strong>{{ domain.label }}</strong
              ><small>{{ domain.description }}</small></span
            >
            <span class="domain-list__count"
              ><strong>{{ formatNumberValue(domain.recordCount) }}</strong
              ><small>{{ domain.sourceCount }} 类治理对象</small
              ><em :class="{ 'is-complete': !domain.attentionCount }">
                {{
                  domain.attentionCount
                    ? `${formatNumberValue(domain.attentionCount)} 条待完善`
                    : '关键资料完整'
                }}
              </em></span
            >
            <ArtSvgIcon class="domain-list__arrow" icon="ri:arrow-right-line" />
          </button>
        </div>
      </ArtSectionCard>

      <div class="mdm-workbench__aside">
        <ArtSectionCard
          title="治理健康度"
          subtitle="完整度达 90 分的记录占当前可见记录的比例。"
          :loading="loading"
          :error="errorMessage"
          retryable
          :empty="!totalRecords"
          empty-title="暂无可评估的主数据"
          empty-description="来源系统建立业务记录后，可在此查看资料完整率。"
          @retry="loadOverview"
          preserve-content-structure
        >
          <div class="coverage-ring" :style="{ '--coverage': `${coveragePercent}%` }">
            <div
              ><strong>{{ coveragePercent }}%</strong><small>资料完整率</small></div
            >
          </div>
          <div class="coverage-legend">
            <div
              ><span></span
              ><strong>{{ formatNumberValue(totalRecords - attentionCount) }} 条</strong
              ><small>资料完整</small></div
            >
            <div
              ><span></span><strong>{{ formatNumberValue(attentionCount) }} 条</strong
              ><small>待完善</small></div
            >
          </div>
        </ArtSectionCard>

        <ArtSectionCard
          title="治理边界"
          subtitle="查询、维护与权限各有明确入口。"
          preserve-content-structure
        >
          <div class="governance-rules">
            <article
              ><span><ArtSvgIcon icon="ri:search-eye-line" /></span
              ><div
                ><strong>MDM 统一查询</strong><p>汇聚标准编码、名称、状态与更新时间。</p></div
              ></article
            >
            <article
              ><span><ArtSvgIcon icon="ri:edit-2-line" /></span
              ><div
                ><strong>受控变更发布</strong><p>治理审批生成指令，来源系统负责幂等落地。</p></div
              ></article
            >
            <article
              ><span><ArtSvgIcon icon="ri:shield-check-line" /></span
              ><div
                ><strong>数据按权限可见</strong><p>仅展示当前账号可访问的主档资料。</p></div
              ></article
            >
          </div>
        </ArtSectionCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { sumBy } from 'lodash-es'
  import { formatNumberValue } from '@/utils/ui/format'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    fetchMdmOverview,
    mdmCatalogSourceKindCounts,
    mdmDomainDefinitions,
    type MdmDomainSummary
  } from '@mdm/api'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase/error'

  defineOptions({ name: 'MdmWorkbench' })

  const router = useRouter()
  const domains = ref<MdmDomainSummary[]>(
    mdmDomainDefinitions.map((domain) => ({ ...domain, recordCount: 0, attentionCount: 0 }))
  )
  const loading = ref(false)
  const errorMessage = ref('')
  let requestController: AbortController | undefined

  const totalRecords = computed(() => sumBy(domains.value, 'recordCount'))
  const attentionCount = computed(() => sumBy(domains.value, 'attentionCount'))
  const coveragePercent = computed(() =>
    totalRecords.value
      ? Math.round(((totalRecords.value - attentionCount.value) / totalRecords.value) * 100)
      : 0
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '主数据记录',
      value: errorMessage.value ? '—' : formatNumberValue(totalRecords.value),
      description: errorMessage.value ? '概览加载失败，请重试' : '当前租户可见记录',
      icon: 'ri:file-list-3-line',
      tone: 'primary',
      loading: loading.value
    },
    {
      label: '治理域',
      value: domains.value.length,
      description: '按业务语义归类',
      icon: 'ri:layout-grid-line',
      tone: 'success',
      loading: loading.value
    },
    {
      label: '独立主档类型',
      value: mdmCatalogSourceKindCounts.master,
      description: `另有 ${mdmCatalogSourceKindCounts.relation} 类关系/明细对象`,
      icon: 'ri:stack-line',
      tone: 'success',
      loading: loading.value
    },
    {
      label: '待完善记录',
      value: errorMessage.value ? '—' : formatNumberValue(attentionCount.value),
      description: errorMessage.value
        ? '概览加载失败，请重试'
        : attentionCount.value
          ? '按资料缺口进入来源系统处理'
          : '当前未发现关键字段缺口',
      icon: 'ri:error-warning-line',
      tone: attentionCount.value ? 'warning' : 'success',
      loading: loading.value
    }
  ])

  const defaultDomainPath: Record<MdmDomainSummary['key'], string> = {
    organization: '/mdm/governance/organization/organization-directory',
    partner: '/mdm/governance/partner/business-partner-directory',
    logistics: '/mdm/governance/logistics/logistics-directory',
    asset: '/mdm/governance/asset/vehicle-directory',
    material: '/mdm/governance/material/material-directory'
  }

  async function loadOverview(): Promise<void> {
    if (loading.value) return
    requestController = new AbortController()
    const { signal } = requestController
    loading.value = true
    errorMessage.value = ''
    try {
      const result = await fetchMdmOverview({ signal })
      if (!signal.aborted) domains.value = result
    } catch (error) {
      if (!signal.aborted)
        errorMessage.value = getFriendlySupabaseErrorMessage(error, '主数据概览加载失败，请重试')
    } finally {
      loading.value = false
    }
  }

  function openDomain(domain: MdmDomainSummary['key']): void {
    void router.push(defaultDomainPath[domain])
  }

  onMounted(() => void loadOverview())
  onBeforeUnmount(() => requestController?.abort())
</script>

<style scoped lang="scss">
  .mdm-workbench {
    &__content {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(310px, 0.8fr);
      gap: 16px;
      align-items: start;
      min-height: 0;
    }

    &__directory {
      min-width: 0;
    }

    &__aside {
      display: grid;
      gap: 16px;
      min-width: 0;
    }
  }

  .domain-list {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);

    button {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto auto;
      gap: 12px;
      align-items: center;
      min-width: 0;
      padding: 14px 16px;
      color: inherit;
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      transition: background-color 0.16s ease;

      + button {
        border-top: 1px solid var(--el-border-color-lighter);
      }

      &:hover {
        background: var(--el-fill-color-lighter);
      }

      &:focus-visible {
        outline: 2px solid var(--el-color-primary-light-5);
        outline-offset: -2px;
      }
    }

    &__index {
      font-size: 10px;
      font-weight: 700;
      color: var(--el-text-color-placeholder);
      letter-spacing: 0.08em;
    }

    &__icon {
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      font-size: 18px;
      color: var(--el-color-primary);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    &__copy,
    &__count {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    &__copy strong {
      font-size: 13px;
    }

    &__copy small {
      font-size: 12px;
      line-height: 1.6;
      color: var(--el-text-color-secondary);
      overflow-wrap: anywhere;
    }

    &__count {
      justify-items: end;
      min-width: 76px;
    }

    &__count strong {
      font-size: 17px;
      font-variant-numeric: tabular-nums;
    }

    &__count small {
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }

    &__count em {
      font-size: 10px;
      font-style: normal;
      font-weight: 650;
      color: var(--el-color-warning);
    }

    &__count em.is-complete {
      color: var(--el-color-success);
    }

    &__arrow {
      color: var(--el-text-color-placeholder);
    }
  }

  .coverage-ring {
    position: relative;
    display: grid;
    place-items: center;
    width: 126px;
    height: 126px;
    margin: 4px auto 16px;
    background: conic-gradient(var(--el-color-primary) var(--coverage), var(--el-fill-color) 0);
    border-radius: 50%;

    &::before {
      position: absolute;
      width: 94px;
      height: 94px;
      content: '';
      background: var(--el-bg-color);
      border-radius: 50%;
    }

    > div {
      z-index: 1;
      display: grid;
      justify-items: center;
    }

    strong {
      font-size: 25px;
      font-variant-numeric: tabular-nums;
    }

    small {
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }
  }

  .coverage-legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: var(--el-border-radius-base);

    div {
      position: relative;
      display: grid;
      padding: 11px 12px 11px 21px;
    }

    div + div {
      border-left: 1px solid var(--el-border-color-lighter);
    }

    div:last-child span {
      background: var(--el-color-warning);
    }

    span {
      position: absolute;
      top: 16px;
      left: 10px;
      width: 5px;
      height: 5px;
      background: var(--el-color-primary);
      border-radius: 50%;
    }

    strong {
      font-size: 13px;
    }

    small {
      margin-top: 2px;
      font-size: 10px;
      color: var(--el-text-color-secondary);
    }
  }

  .governance-rules {
    display: grid;

    article {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 11px;
      padding: 10px 0;
    }

    article + article {
      border-top: 1px solid var(--el-border-color-lighter);
    }

    article > span {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      color: var(--el-color-primary);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: var(--el-border-radius-base);
    }

    strong {
      font-size: 12px;
    }

    p {
      margin: 3px 0 0;
      font-size: 11px;
      line-height: 1.55;
      color: var(--el-text-color-secondary);
    }
  }

  @media (width <= 980px) {
    .mdm-workbench__content {
      grid-template-columns: 1fr;
    }

    .mdm-workbench__aside {
      grid-template-rows: auto;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 640px) {
    .mdm-workbench__aside {
      grid-template-columns: 1fr;
    }

    .domain-list button {
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 10px;
      padding: 12px;
    }

    .domain-list__index {
      display: none;
    }

    .domain-list__count {
      grid-column: 2;
      justify-items: start;
    }

    .domain-list__arrow {
      grid-row: 1 / 3;
      grid-column: 3;
    }
  }
</style>
