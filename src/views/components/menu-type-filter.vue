<template>
  <BusinessMenuFilter
    class="menu-type-filter"
    :data="displayTree"
    :labels="labels"
    :summary="`${menuPageCount} 个菜单 · ${assignedMenuCount} 个已配置`"
    :all-count="totalCount"
    :count="(node) => node.totalCount"
    :direct-count="(node) => node.directCount"
    :search-terms="(node) => [node.component]"
    :icon="resolveNodeIcon"
    :selected-menu-id="selectedMenuId"
    :loading="loading"
    @select="emit('select', $event)"
    @refresh="emit('refresh')"
  />
</template>
<script setup lang="ts">
  import BusinessMenuFilter from '@/components/business/business-menu-filter/index.vue'
  import type { BusinessMenuFilterLabels } from '@/components/business/business-menu-filter/types'

  import TreeUtils from '@/utils/tree'
  import type { AppRouteRecord } from '@/types/router'

  interface MenuTypeNode extends AppRouteRecord {
    id: string
    parentId?: string | null
    type: 'folder' | 'menu'
    component?: string
    children?: MenuTypeNode[]
  }

  interface DisplayMenuNode extends MenuTypeNode {
    directCount: number
    totalCount: number
    children?: DisplayMenuNode[]
  }

  const props = withDefaults(
    defineProps<{
      subject: '业务类型' | '单据类型'
      data: MenuTypeNode[]
      counts: Record<string, number>
      selectedMenuId?: string
      loading?: boolean
    }>(),
    {
      selectedMenuId: '',
      loading: false
    }
  )

  const emit = defineEmits<{
    select: [menuId: string]
    refresh: []
  }>()

  const treeUtils = new TreeUtils({ idKey: 'id', parentKey: 'parentId', childrenKey: 'children' })

  const displayTree = computed<DisplayMenuNode[]>(
    () =>
      treeUtils.mapTree<MenuTypeNode>(props.data, (menu) => {
        const relatedMenus = treeUtils.getDescendants(props.data, menu.id, true)
        return {
          ...menu,
          directCount: props.counts[menu.id] ?? 0,
          totalCount: relatedMenus.reduce((total, item) => total + (props.counts[item.id] ?? 0), 0)
        } as DisplayMenuNode
      }) as DisplayMenuNode[]
  )
  const flatTree = computed(() => treeUtils.treeToList(displayTree.value))
  const menuPageCount = computed(() => flatTree.value.filter((item) => item.type === 'menu').length)
  const assignedMenuCount = computed(
    () => Object.values(props.counts).filter((count) => count > 0).length
  )
  const totalCount = computed(() =>
    Object.values(props.counts).reduce((total, count) => total + count, 0)
  )

  const resolveNodeIcon = (menu: DisplayMenuNode): string =>
    menu.type === 'folder' ? 'ri:folder-3-line' : String(menu.meta?.icon || 'ri:file-list-3-line')

  const labels = computed<BusinessMenuFilterLabels>(() => ({
    ...{
      ariaLabel: '',
      heading: '功能导航',
      refresh: '刷新菜单目录',
      search: '搜索菜单功能',
      allAriaLabel: '全部菜单功能',
      all: '全部功能',
      allDescription: '',
      treeHint: '选择目录包含下级',
      errorTitle: '菜单加载失败',
      emptyTitle: '暂无可用菜单功能',
      emptyDescription: '请刷新后重试，或联系管理员检查菜单配置。',
      current: '当前筛选',
      unit: '项',
      direct: '直接配置'
    },
    ariaLabel: `${props.subject}功能菜单筛选`,
    allDescription: `查看当前数据范围内全部${props.subject}`
  }))
</script>
