<template>
  <StorageCardActions
    :name="bin.binName"
    :actions="actions"
    :overlay="overlay"
    @click="handleAction"
  />
</template>

<script setup lang="ts">
  import type { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import type { StorageBin } from '@mdm/api'
  import StorageCardActions from './storage-card-actions.vue'

  defineProps<{ bin: StorageBin; overlay?: boolean }>()
  const emit = defineEmits<{ edit: []; child: []; remove: [] }>()
  const actions: ButtonMoreItem[] = [
    { key: 'edit', label: '编辑库位', auth: 'MdmWarehouseBin:Edit' },
    { key: 'child', label: '新增子单元', auth: 'MdmWarehouseBin:Add' },
    {
      key: 'remove',
      label: '删除库位',
      auth: 'MdmWarehouseBin:Delete',
      color: 'var(--el-color-danger)'
    }
  ]

  function handleAction(item: ButtonMoreItem): void {
    if (item.key === 'edit') emit('edit')
    if (item.key === 'child') emit('child')
    if (item.key === 'remove') emit('remove')
  }
</script>
