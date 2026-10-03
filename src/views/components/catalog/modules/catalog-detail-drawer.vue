<template>
  <ArtDrawer ref="drawerRef" size="lg" :show-footer="false" show-fullscreen-button>
    <div v-if="record" class="mdm-catalog-detail">
      <section class="mdm-catalog-detail__hero art-card-xs">
        <div class="mdm-catalog-detail__identity">
          <span class="mdm-catalog-detail__source-icon" aria-hidden="true">
            <ArtSvgIcon icon="ri:database-2-line" />
          </span>
          <div>
            <small>{{ record.sourceLabel }} · {{ sourceAppLabel(record.sourceApp) }}</small>
            <h2>{{ record.name }}</h2>
            <p
              >{{ record.code
              }}<template v-if="record.subtitle"> · {{ record.subtitle }}</template></p
            >
          </div>
        </div>
        <div class="mdm-catalog-detail__badges">
          <ElTag :type="record.isActive ? 'success' : 'info'" effect="light" round>
            {{ record.isActive ? '有效' : '停用' }}
          </ElTag>
          <ElTag :type="record.qualityScore >= 90 ? 'success' : 'warning'" effect="plain" round>
            完整度 {{ record.qualityScore }}%
          </ElTag>
        </div>
      </section>

      <ArtSectionCard
        title="主档身份"
        subtitle="用于跨业务系统识别与核对的稳定信息。"
        preserve-content-structure
      >
        <ArtDescriptions :data="record" :items="identityItems" :columns="2" :tablet-columns="2" />
      </ArtSectionCard>

      <ArtSectionCard
        title="治理与来源"
        subtitle="业务资料由来源系统维护，本页供查询与核对。"
        preserve-content-structure
      >
        <ArtDescriptions :data="record" :items="governanceItems" :columns="2" :tablet-columns="2" />
      </ArtSectionCard>

      <ArtSectionCard
        v-if="visibleAttributes.length"
        title="业务属性"
        subtitle="与当前主档相关的业务信息。"
        preserve-content-structure
      >
        <dl class="mdm-catalog-detail__attributes">
          <div v-for="attribute in visibleAttributes" :key="attribute.label">
            <dt>{{ attribute.label }}</dt>
            <dd>{{ formatAttribute(attribute.value) }}</dd>
          </div>
        </dl>
      </ArtSectionCard>

      <section
        class="mdm-catalog-detail__quality"
        :class="{ 'is-complete': !record.qualityIssues.length }"
      >
        <span aria-hidden="true">
          <ArtSvgIcon
            :icon="record.qualityIssues.length ? 'ri:error-warning-line' : 'ri:shield-check-line'"
          />
        </span>
        <div>
          <strong>{{ record.qualityIssues.length ? '资料仍需完善' : '关键资料已完整' }}</strong>
          <p v-if="!record.qualityIssues.length">当前规则下未发现需要补充的关键字段。</p>
          <ul v-else>
            <li v-for="issue in record.qualityIssues" :key="issue">{{ issue }}</li>
          </ul>
        </div>
      </section>
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { MdmCatalogRecord } from '@mdm/api'

  defineOptions({ name: 'MdmCatalogDetailDrawer' })

  const drawerRef = ref<ArtDrawerExpose<MdmCatalogRecord>>()
  const record = ref<MdmCatalogRecord | null>(null)

  const formatDateTime = (value?: string | null): string => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
  }

  const sourceAppLabel = (value: string): string => {
    const labels: Record<string, string> = {
      platform: '平台中心',
      hr: 'HR 人力资源',
      tms: 'TMS 智慧运输',
      vms: 'VMS 车辆管理',
      smis: 'SMIS 安全管理'
    }
    return labels[value] ?? value.toUpperCase()
  }

  const identityItems: ArtDescriptionItem<MdmCatalogRecord>[] = [
    { key: 'code', label: '主数据编码', field: 'code', copyable: true },
    { key: 'name', label: '主数据名称', field: 'name' },
    {
      key: 'status',
      label: '生命周期状态',
      value: (data: MdmCatalogRecord) => (data.isActive ? '有效' : '停用')
    },
    { key: 'subtitle', label: '业务摘要', field: 'subtitle' }
  ]

  const governanceItems: ArtDescriptionItem<MdmCatalogRecord>[] = [
    { key: 'sourceLabel', label: '主数据类型', field: 'sourceLabel' },
    {
      key: 'sourceApp',
      label: '权威来源',
      value: (data: MdmCatalogRecord) => sourceAppLabel(data.sourceApp)
    },
    {
      key: 'createTime',
      label: '创建时间',
      value: (data: MdmCatalogRecord) => formatDateTime(data.createTime)
    },
    {
      key: 'updateTime',
      label: '最近更新',
      value: (data: MdmCatalogRecord) => formatDateTime(data.updateTime)
    }
  ]

  const visibleAttributes = computed(() =>
    (record.value?.attributes ?? []).filter(
      (attribute) => attribute.value !== null && attribute.value !== ''
    )
  )

  const formatAttribute = (value: string | number | boolean | null): string =>
    value === null || value === ''
      ? '—'
      : typeof value === 'boolean'
        ? value
          ? '是'
          : '否'
        : String(value)

  const handleOpen = async (row: MdmCatalogRecord): Promise<void> => {
    record.value = row
    await drawerRef.value?.handleOpen(row, {
      title: '主数据详情',
      subtitle: `${row.sourceLabel} · ${row.code}`,
      contentHeight: 'calc(100vh - 86px)',
      showFooter: false
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .mdm-catalog-detail {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 2px;

    &__hero,
    &__identity,
    &__badges,
    &__quality {
      display: flex;
      align-items: center;
    }

    &__hero {
      gap: 18px;
      justify-content: space-between;
      padding: 20px;
      background: linear-gradient(
        120deg,
        var(--el-fill-color-light),
        color-mix(in srgb, var(--theme-color) 7%, var(--el-bg-color))
      );
    }

    &__identity {
      gap: 14px;
      min-width: 0;

      > div {
        min-width: 0;
      }

      small {
        font-weight: 650;
        color: var(--el-color-primary);
      }

      h2 {
        margin: 3px 0;
        font-size: 21px;
        color: var(--el-text-color-primary);
        overflow-wrap: anywhere;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: var(--el-text-color-secondary);
        overflow-wrap: anywhere;
      }
    }

    &__source-icon,
    &__quality > span {
      display: grid;
      flex: 0 0 auto;
      place-items: center;
      color: var(--el-color-primary);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--el-bg-color));
      border-radius: 12px;
    }

    &__source-icon {
      width: 46px;
      height: 46px;
      font-size: 22px;
    }

    &__badges {
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    &__attributes {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1px;
      margin: 0;
      overflow: hidden;
      background: var(--el-border-color-lighter);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: 10px;

      > div {
        min-width: 0;
        padding: 12px 14px;
        background: var(--el-bg-color);
      }

      dt {
        margin-bottom: 4px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 0;
        font-size: 13px;
        color: var(--el-text-color-primary);
        overflow-wrap: anywhere;
      }
    }

    &__quality {
      gap: 12px;
      align-items: flex-start;
      padding: 16px;
      color: var(--el-color-warning);
      background: var(--el-color-warning-light-9);
      border: 1px solid var(--el-color-warning-light-7);
      border-radius: 10px;

      &.is-complete {
        color: var(--el-color-success);
        background: var(--el-color-success-light-9);
        border-color: var(--el-color-success-light-7);
      }

      > span {
        width: 34px;
        height: 34px;
        color: currentcolor;
        background: color-mix(in srgb, currentcolor 10%, transparent);
      }

      strong {
        color: var(--el-text-color-primary);
      }

      p,
      ul {
        margin: 5px 0 0;
        font-size: 13px;
        line-height: 1.7;
        color: var(--el-text-color-secondary);
      }

      ul {
        padding-left: 18px;
      }
    }
  }

  @media (width <= 700px) {
    .mdm-catalog-detail {
      &__hero {
        flex-direction: column;
        align-items: flex-start;
      }

      &__badges {
        justify-content: flex-start;
      }

      &__attributes {
        grid-template-columns: 1fr;
      }
    }
  }
</style>
