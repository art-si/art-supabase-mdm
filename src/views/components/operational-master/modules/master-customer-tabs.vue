<template>
  <ElTabs v-if="enabled" v-model="activeTab" class="min-w-0 art-card-xs art-overlay-tab-card">
    <ElTabPane label="客户主档" name="master"><slot /></ElTabPane>
    <ElTabPane label="联系人" name="contacts" lazy><slot name="contacts" /></ElTabPane>
    <ElTabPane label="财务信息" name="finance" lazy><slot name="finance" /></ElTabPane>
  </ElTabs>
  <slot v-else />
</template>

<script setup lang="ts">
  export type MasterCustomerTab = 'master' | 'contacts' | 'finance'

  defineOptions({ name: 'MdmMasterCustomerTabs' })
  defineProps<{ enabled: boolean }>()
  const activeTab = defineModel<MasterCustomerTab>({ required: true })
</script>
