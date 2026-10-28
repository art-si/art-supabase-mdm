<template>
  <ArtSectionCard
    :show-scrollbar="false"
    class="bom-group-panel"
    title="BOM 分组"
    subtitle="选择分组后联动筛选右侧 BOM"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !groups.length"
    empty-title="尚未建立 BOM 分组"
    empty-description="可先建立顶级分组，再逐层归类 BOM。"
    retryable
    body-class="bom-group-panel__body"
    @retry="$emit('refresh')"
  >
    <template #actions>
      <div class="bom-group-panel__actions">
        <ArtTreeExpandToggle
          :tree="treeRef"
          :data="treeData"
          label="BOM 分组树"
          :default-expanded="groups.length < 18"
        />
        <ArtIconButton
          v-auth="'MdmBomMaintenance:ManageGroup'"
          icon="ri:add-line"
          label="新增 BOM 分组"
          @click="$emit('add')"
        />
        <ArtIconButton icon="ri:refresh-line" label="刷新 BOM 分组" @click="$emit('refresh')" />
      </div>
    </template>

    <ElInput
      v-model="keyword"
      clearable
      placeholder="搜索分组名称或编码"
      aria-label="搜索 BOM 分组"
    >
      <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
    </ElInput>

    <button
      type="button"
      class="bom-group-panel__all art-master-group-all-button"
      :class="{ 'is-current': !selectedId }"
      :aria-pressed="!selectedId"
      @click="$emit('select')"
    >
      <span aria-hidden="true"><ArtSvgIcon icon="ri:apps-2-line" /></span>
      <span
        ><strong>全部分组</strong><small>{{ groups.length }} 个分组节点</small></span
      >
      <ArtSvgIcon v-if="!selectedId" icon="ri:check-line" aria-hidden="true" />
    </button>

    <ElScrollbar class="bom-group-panel__scroll">
      <ElTree
        ref="treeRef"
        :data="treeData"
        node-key="id"
        :props="{ label: 'name', children: 'children' }"
        :current-node-key="selectedId || undefined"
        :filter-node-method="filterNode"
        :default-expand-all="groups.length < 18"
        highlight-current
        :expand-on-click-node="false"
        @node-click="$emit('select', $event)"
      >
        <template #default="{ data }">
          <div class="bom-group-panel__node">
            <span aria-hidden="true"><ArtSvgIcon icon="ri:folder-3-line" /></span>
            <span>
              <strong :title="data.name">{{ data.name }}</strong>
              <small>{{ data.code }}</small>
            </span>
            <span class="bom-group-panel__node-actions" @click.stop>
              <ArtButtonMore
                :list="groupActions"
                @click="(item) => handleGroupAction(item, data)"
              />
            </span>
          </div>
        </template>
        <template #empty>
          <ArtEmptyState
            title="未找到匹配项"
            description="请调整关键词或清空筛选条件。"
            size="compact"
            :visual-size="64"
          />
        </template>
      </ElTree>
    </ElScrollbar>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import type { ElTree } from 'element-plus'
  import TreeUtils from '@/utils/tree'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { BomGroup } from '@mdm/api'

  const props = defineProps<{
    groups: BomGroup[]
    selectedId: string
    loading: boolean
    error: Error | null
    deleteBusy?: boolean
  }>()
  const emit = defineEmits<{
    select: [group?: BomGroup]
    refresh: []
    add: [parent?: BomGroup]
    edit: [row: BomGroup]
    remove: [row: BomGroup]
  }>()
  const groupActions = computed<ButtonMoreItem[]>(() => [
    {
      key: 'add',
      label: '新增下级分组',
      icon: 'ri:add-line',
      auth: 'MdmBomMaintenance:ManageGroup'
    },
    { key: 'edit', label: '编辑分组', icon: 'ri:edit-line', auth: 'MdmBomMaintenance:ManageGroup' },
    {
      key: 'delete',
      label: '删除分组',
      icon: 'ri:delete-bin-6-line',
      color: 'var(--el-color-danger)',
      auth: 'MdmBomMaintenance:ManageGroup',
      disabled: props.deleteBusy
    }
  ])
  const handleGroupAction = (item: ButtonMoreItem, group: BomGroup) => {
    if (item.key === 'add') emit('add', group)
    else if (item.key === 'edit') emit('edit', group)
    else if (item.key === 'delete') emit('remove', group)
  }

  const keyword = ref('')
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const treeUtils = new TreeUtils({ parentKey: 'parentId' })
  const treeData = computed(() =>
    treeUtils.listToTree(
      props.groups,
      (left, right) => left.sort - right.sort || left.name.localeCompare(right.name, 'zh-CN')
    )
  )
  const filterNode = (value: string, data: Record<string, unknown>): boolean =>
    !value ||
    `${String(data.name ?? '')} ${String(data.code ?? '')}`
      .toLowerCase()
      .includes(value.toLowerCase())

  watch(keyword, (value) => treeRef.value?.filter(value))
  watch(
    () => props.selectedId,
    async (id) => {
      await nextTick()
      treeRef.value?.setCurrentKey(id || undefined)
      if (id) {
        let parent = treeRef.value?.getNode(id)?.parent
        while (parent) {
          parent.expanded = true
          parent = parent.parent
        }
      }
    },
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .bom-group-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    :deep(.bom-group-panel__body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
    }

    &__actions,
    &__node-actions {
      display: flex;
      gap: 2px;
    }

    &__all {
      > span:nth-child(2) {
        display: grid;
        min-width: 0;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__scroll {
      flex: 1;
      min-height: 0;
    }

    &__node {
      display: grid;
      flex: 1;
      grid-template-columns: 20px minmax(0, 1fr) auto;
      gap: 7px;
      align-items: center;
      min-width: 0;

      > span:nth-child(2) {
        display: grid;
        min-width: 0;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: 10px;
        color: var(--el-text-color-secondary);
      }
    }

    &__node-actions {
      opacity: 0;
      transition: opacity var(--art-motion-duration-fast);
    }

    :deep(.el-tree-node__content) {
      min-height: 48px;
      margin-bottom: 2px;
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        background-color var(--art-motion-duration-fast),
        border-color var(--art-motion-duration-fast),
        box-shadow var(--art-motion-duration-fast);

      &:hover,
      &:focus-within {
        background: var(--art-gray-100);
        border-color: var(--el-border-color-lighter);
      }

      &:hover .bom-group-panel__node-actions,
      &:focus-within .bom-group-panel__node-actions {
        opacity: 1;
      }
    }

    :deep(.el-tree-node.is-current > .el-tree-node__content) {
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
      border-color: color-mix(in srgb, var(--theme-color) 18%, transparent);
      box-shadow: inset 3px 0 0 var(--theme-color);
    }
  }
</style>
