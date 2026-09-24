<template>
  <div class="mt-1 flex items-center justify-end gap-1">
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
