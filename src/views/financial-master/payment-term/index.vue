<template>
  <PayablePaymentTerms
    :permissions="{
      View: 'MdmPaymentTerm:View',
      Add: 'MdmPaymentTerm:Add',
      Edit: 'MdmPaymentTerm:Edit',
      Delete: 'MdmPaymentTerm:Delete'
    }"
  />
</template>
<script setup lang="ts">
  import PayablePaymentTerms from '@/components/business/payable-payment-terms/index.vue'
  defineOptions({ name: 'MdmPaymentTerm' })
</script>
