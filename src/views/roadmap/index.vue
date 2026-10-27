<template>
  <div class="mdm-roadmap business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      eyebrow="ENGINEERING MASTER DATA"
      :title="page.title"
      :description="page.description"
      :icon="page.icon"
      :tags="[
        { label: '工程主数据', type: 'primary' },
        { label: '菜单已规划', type: 'success' }
      ]"
      :metrics="metrics"
    />
    <ArtSectionCard
      title="实施边界"
      subtitle="本阶段先完成企业菜单架构和物料主数据，工程主数据按审查结果继续建设。"
      preserve-content-structure
    >
      <div class="mdm-roadmap__panel">
        <span class="mdm-roadmap__icon"><ArtSvgIcon :icon="page.icon" /></span>
        <div
          ><small>NEXT DELIVERY</small><h2>{{ page.title }}</h2
          ><p>{{ page.description }}</p></div
        >
        <ElTag type="warning" effect="light" size="small" round>下一阶段</ElTag>
      </div>
    </ArtSectionCard>
  </div>
</template>

<script setup lang="ts">
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  defineOptions({ name: 'MdmEngineeringRoadmap' })
  const route = useRoute()
  const pages: Record<string, { title: string; description: string; icon: string }> = {
    'bom-maintenance': {
      title: 'BOM维护',
      description: '维护产品结构、版本、生效区间与替代料关系。',
      icon: 'ri:git-fork-line'
    },
    'bom-structure': {
      title: 'BOM结构查询',
      description: '以树形方式查询产品、半成品和原材料层级。',
      icon: 'ri:node-tree'
    },
    esop: {
      title: 'ESOP',
      description: '统一维护电子标准作业指导书及其版本与适用范围。',
      icon: 'ri:file-list-3-line'
    }
  }
  const page = computed(
    () => pages[String(route.path.split('/').at(-1))] ?? pages['bom-maintenance']
  )
  const metrics: BusinessWorkspaceMetric[] = [
    {
      label: '菜单状态',
      value: '已规划',
      description: '企业级信息架构',
      icon: 'ri:menu-search-line',
      tone: 'success'
    },
    {
      label: '数据模型',
      value: '待评审',
      description: '跟随物料模块审查',
      icon: 'ri:database-2-line',
      tone: 'warning'
    },
    {
      label: '实施阶段',
      value: '下一阶段',
      description: '不混入当前交付',
      icon: 'ri:flag-line',
      tone: 'info'
    }
  ]
</script>

<style scoped lang="scss">
  .mdm-roadmap :deep(.art-section-card) {
    padding: 18px;
  }

  .mdm-roadmap__panel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-height: 180px;
    padding: 24px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-color) 8%, var(--el-bg-color)),
      var(--el-bg-color)
    );
    border: 1px solid color-mix(in srgb, var(--theme-color) 16%, var(--el-border-color-lighter));
    border-radius: var(--el-border-radius-base);
  }

  .mdm-roadmap__icon {
    display: grid;
    place-items: center;
    width: 66px;
    height: 66px;
    font-size: 29px;
    color: var(--theme-color);
    background: var(--el-bg-color);
    border-radius: var(--art-surface-radius);
  }

  .mdm-roadmap__panel small {
    font-size: 10px;
    font-weight: 700;
    color: var(--theme-color);
    letter-spacing: 0.12em;
  }

  .mdm-roadmap__panel h2 {
    margin: 5px 0 7px;
    font-size: 22px;
  }

  .mdm-roadmap__panel p {
    max-width: 760px;
    margin: 0;
    font-size: 13px;
    line-height: 1.7;
    color: var(--el-text-color-secondary);
  }

  @media (width <= 680px) {
    .mdm-roadmap__panel {
      grid-template-columns: 1fr;
    }

    .mdm-roadmap__panel > .el-tag {
      justify-self: start;
    }
  }
</style>
