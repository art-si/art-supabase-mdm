<template>
  <component :is="currentWorkspace" :key="route.path" />
</template>

<script setup lang="ts">
  import OutboundRuleWorkspace from './modules/outbound-rule-workspace.vue'
  import SupplyChainCodeRuleWorkspace from './modules/supply-chain-code-rule-workspace.vue'

  defineOptions({ name: 'MdmInventoryConfiguration' })

  const route = useRoute()
  const currentWorkspace = computed(() =>
    route.path.endsWith('/outbound-rule') ? OutboundRuleWorkspace : SupplyChainCodeRuleWorkspace
  )
</script>
