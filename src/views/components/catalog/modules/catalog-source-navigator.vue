<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="catalog-navigator"
    title="主档分类"
    subtitle="按业务类型定位资料"
    body-class="catalog-navigator__body"
  >
    <template #actions
      ><ElTag type="info" effect="plain">{{ sources.length }} 类</ElTag></template
    >
    <ElInput
      v-if="sources.length > 4"
      v-model="keyword"
      clearable
      placeholder="搜索主档分类"
      aria-label="搜索主档分类"
    >
      <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
    </ElInput>
    <ElScrollbar class="catalog-navigator__scroll">
      <nav aria-label="主档分类">
        <button
          type="button"
          :class="{ 'is-current': !selected }"
          :aria-current="!selected ? 'true' : undefined"
          @click="$emit('select', undefined)"
        >
          <ArtSvgIcon icon="ri:stack-line" /><span
            ><strong>全部主档</strong><small>查看本目录全部类型</small></span
          ><ArtSvgIcon v-if="!selected" icon="ri:check-line" />
        </button>
        <button
          v-for="source in visibleSources"
          :key="source.type"
          type="button"
          :class="{ 'is-current': selected === source.type }"
          :aria-current="selected === source.type ? 'true' : undefined"
          @click="$emit('select', source.type)"
        >
          <ArtSvgIcon icon="ri:folder-3-line" /><span
            ><strong>{{ source.label }}</strong
            ><small
              >{{ source.app === 'platform' ? '平台' : source.app.toUpperCase() }} ·
              {{ source.kind === 'relation' ? '关系明细' : '权威主档' }}</small
            ></span
          ><ArtSvgIcon v-if="selected === source.type" icon="ri:check-line" />
        </button>
        <ArtEmptyState
          v-if="!visibleSources.length"
          size="compact"
          title="未找到分类"
          description="试试其他分类名称。"
        />
      </nav>
    </ElScrollbar>
    <p class="catalog-navigator__note"
      ><ArtSvgIcon icon="ri:information-line" />主档资料由来源系统维护，本页用于查询与核对。</p
    >
  </ArtSectionCard>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import type { MdmCatalogSourceDefinition } from '@mdm/api'
  const props = defineProps<{ sources: MdmCatalogSourceDefinition[]; selected?: string }>()
  defineEmits<{ select: [type: string | undefined] }>()
  const keyword = ref('')
  const visibleSources = computed(() =>
    props.sources.filter((source) => source.label.includes(keyword.value.trim()))
  )
  watch(
    () => props.sources,
    () => {
      keyword.value = ''
    }
  )
</script>
<style scoped lang="scss">
  .catalog-navigator {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    :deep(.catalog-navigator__body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
    }

    &__scroll {
      flex: 1;
      min-height: 0;
    }

    nav {
      display: grid;
      gap: 6px;
    }

    button {
      display: flex;
      gap: 10px;
      align-items: center;
      width: 100%;
      padding: 12px;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--el-border-radius-base);
    }

    button:hover {
      background: var(--el-fill-color-light);
    }

    button.is-current {
      color: var(--theme-color);
      background: var(--el-color-primary-light-9);
    }

    button:focus-visible {
      outline: 2px solid var(--theme-color);
      outline-offset: -2px;
    }

    button > span {
      display: grid;
      flex: 1;
      gap: 4px;
      min-width: 0;
    }

    strong {
      font-size: 13px;
      font-weight: 600;
    }

    small {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__note {
      display: flex;
      gap: 8px;
      padding-top: 12px;
      margin: 0;
      font-size: 12px;
      line-height: 1.7;
      color: var(--el-text-color-secondary);
      border-top: 1px solid var(--el-border-color-lighter);

      :deep(svg) {
        flex-shrink: 0;
        margin-top: 3px;
      }
    }
  }
</style>
