<template>
  <PayableReferenceWorkspace
    kind="method"
    :permissions="{
      View: 'MdmSettlementMethod:View',
      Add: 'MdmSettlementMethod:Add',
      Edit: 'MdmSettlementMethod:Edit',
      Delete: 'MdmSettlementMethod:Delete'
    }"
  />
</template>
<script setup lang="ts">
  import PayableReferenceWorkspace from '@/components/business/payable-reference-workspace/index.vue'
  defineOptions({ name: 'MdmSettlementMethod' })
</script>
