<template>
  <ElTabs v-if="enabled" v-model="activeTab" class="min-w-0">
    <ElTabPane label="客户主档" name="master"><slot /></ElTabPane>
    <ElTabPane label="联系人" name="contacts" lazy><slot name="contacts" /></ElTabPane>
    <ElTabPane label="财务信息" name="finance" lazy><slot name="finance" /></ElTabPane>
  </ElTabs>
  <slot v-else />
</template>

<script setup lang="ts">
  defineOptions({ name: 'MdmMasterCustomerTabs' })
  const props = defineProps<{ enabled: boolean; recordId?: string }>()
  const activeTab = ref('master')
  watch(
    () => [props.enabled, props.recordId],
    () => {
      activeTab.value = 'master'
    }
  )
</script>
