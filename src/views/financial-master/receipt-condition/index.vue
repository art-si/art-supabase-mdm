<template>
  <ReceivableReceiptConditions
    :permissions="{
      View: 'MdmReceiptCondition:View',
      Add: 'MdmReceiptCondition:Add',
      Edit: 'MdmReceiptCondition:Edit',
      Delete: 'MdmReceiptCondition:Delete'
    }"
  />
</template>
<script setup lang="ts">
  import ReceivableReceiptConditions from '@/components/business/receivable-receipt-conditions/index.vue'
  defineOptions({ name: 'MdmReceiptCondition' })
</script>
