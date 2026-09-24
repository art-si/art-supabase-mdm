<template>
  <div class="bin-actions mt-2 flex items-center justify-end gap-1.5">
    <ArtIconButton
      icon="ri:edit-line"
      :label="`编辑${bin.binName}`"
      permission="MdmWarehouseBin:Edit"
      @click="$emit('edit')"
    />
    <ArtIconButton
      icon="ri:add-line"
      :label="`为${bin.binName}新增子单元`"
      permission="MdmWarehouseBin:Add"
      @click="$emit('child')"
    />
    <ArtIconButton
      icon="ri:delete-bin-line"
      :label="`删除${bin.binName}`"
      permission="MdmWarehouseBin:Delete"
      tone="danger"
      @click="$emit('remove')"
    />
  </div>
</template>

<script setup lang="ts">
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import type { StorageBin } from '@mdm/api'

  defineProps<{ bin: StorageBin }>()
  defineEmits<{ edit: []; child: []; remove: [] }>()
</script>

<style scoped>
  .bin-actions :deep(.art-icon-button) {
    border: 1px solid var(--el-border-color);
    background-color: var(--el-bg-color);
    font-size: 1rem;
  }
</style>
