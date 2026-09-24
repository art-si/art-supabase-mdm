<template>
  <ArtDialog ref="dialogRef" size="md" :show-footer="false" :show-fullscreen-button="false">
    <div class="space-y-4">
      <p class="text-sm text-[var(--el-text-color-secondary)]">
        {{ context.label }} · 选择业务后将带入当前仓库{{ context.binId ? '和库位' : '与库区' }}。
      </p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ElButton
          v-for="action in actions"
          :key="action.type"
          v-auth="action.permission"
          class="m-0! w-full! justify-start!"
          :disabled="context.disabled"
          plain
          @click="choose(action.type)"
        >
          <ArtSvgIcon :icon="action.icon" class="mr-2" />
          {{ action.label }}
        </ElButton>
      </div>
      <ElAlert
        v-if="context.disabled"
        title="当前库区或库位不可办理业务；可双击查看已有库存明细。"
        type="warning"
        :closable="false"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'

  export interface StorageActionContext {
    warehouseId: string
    tenantId: string
    label: string
    zoneId?: string
    binId?: string
    batchId?: string
    disabled?: boolean
  }

  const emit = defineEmits<{
    choose: [type: string, context: StorageActionContext]
  }>()
  const dialogRef = ref<ArtDialogExpose<StorageActionContext>>()
  const context = reactive<StorageActionContext>({ warehouseId: '', tenantId: '', label: '' })
  const actions = [
    {
      type: 'purchase_in',
      label: '采购入库',
      icon: 'ri:shopping-cart-line',
      permission: 'MdmInventoryBatch:Receive'
    },
    {
      type: 'production_in',
      label: '生产入库',
      icon: 'ri:factory-line',
      permission: 'MdmInventoryBatch:Receive'
    },
    {
      type: 'other_in',
      label: '其他入库',
      icon: 'ri:inbox-archive-line',
      permission: 'MdmInventoryBatch:Receive'
    },
    {
      type: 'sales_out',
      label: '销售出库',
      icon: 'ri:truck-line',
      permission: 'MdmInventoryBatch:Issue'
    },
    {
      type: 'other_out',
      label: '其他出库',
      icon: 'ri:logout-box-r-line',
      permission: 'MdmInventoryBatch:Issue'
    },
    {
      type: 'transfer',
      label: '库存调拨',
      icon: 'ri:swap-2-line',
      permission: 'MdmInventoryBatch:Transfer'
    }
  ]

  async function choose(type: string): Promise<void> {
    const selected = { ...context }
    dialogRef.value?.handleClose()
    emit('choose', type, selected)
  }
  async function handleOpen(data: StorageActionContext): Promise<void> {
    Object.assign(context, { zoneId: undefined, binId: undefined, disabled: false }, data)
    await dialogRef.value?.handleOpen(data, { title: `${data.label} · 快捷业务` })
  }
  defineExpose({ handleOpen })
</script>
