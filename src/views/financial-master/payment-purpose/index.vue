<template>
  <PayableReferenceWorkspace
    kind="purpose"
    :permissions="{
      View: 'MdmPaymentPurpose:View',
      Add: 'MdmPaymentPurpose:Add',
      Edit: 'MdmPaymentPurpose:Edit'
    }"
  />
</template>
<script setup lang="ts">
  import PayableReferenceWorkspace from '@/components/business/payable-reference-workspace/index.vue'
  defineOptions({ name: 'MdmPaymentPurpose' })
</script>
