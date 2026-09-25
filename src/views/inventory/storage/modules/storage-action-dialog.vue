<template>
  <ArtDialog ref="dialogRef" size="md" :show-footer="false" :show-fullscreen-button="false">
    <div class="space-y-4">
      <p class="text-sm text-[var(--el-text-color-secondary)]">
        {{ context.label }} · 选择业务后将带入当前仓库{{ locationLabel }}。
      </p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ElButton
          v-for="action in visibleActions"
          :key="action.type"
          v-auth="action.permission"
          class="storage-action m-0! h-auto! min-h-16 w-full! justify-start! whitespace-normal! px-3! py-2! text-left!"
          :disabled="context.disabled"
          plain
          @click="choose(action.type)"
        >
          <span class="storage-action__icon"><component :is="action.icon" /></span>
          <span class="storage-action__label">{{ action.label }}</span>
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
  import {
    Box,
    OfficeBuilding,
    Operation,
    ShoppingCart,
    TakeawayBox,
    Van
  } from '@element-plus/icons-vue'
  import { useAuth } from '@/hooks/core/useAuth'

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
  const { hasAuth } = useAuth()
  const dialogRef = ref<ArtDialogExpose<StorageActionContext>>()
  const context = reactive<StorageActionContext>({ warehouseId: '', tenantId: '', label: '' })
  const locationLabel = computed(() =>
    context.binId ? (context.zoneId ? '、库区和库位' : '和库位') : context.zoneId ? '和库区' : ''
  )
  const actions = [
    {
      type: 'purchase_in',
      label: '采购入库',
      icon: ShoppingCart,
      permission: 'MdmInventoryBatch:Receive'
    },
    {
      type: 'production_in',
      label: '生产入库 · 前往 WMS',
      icon: OfficeBuilding,
      permission: 'WmsStockOperation:Receive'
    },
    {
      type: 'other_in',
      label: '其他入库',
      icon: Box,
      permission: 'MdmInventoryBatch:Receive'
    },
    {
      type: 'sales_out',
      label: '销售出库 · 前往 WMS',
      icon: Van,
      permission: 'WmsStockOperation:Issue'
    },
    {
      type: 'other_out',
      label: '其他出库',
      icon: TakeawayBox,
      permission: 'MdmInventoryBatch:Issue'
    },
    {
      type: 'transfer',
      label: '库存调拨',
      icon: Operation,
      permission: 'MdmInventoryBatch:Transfer'
    }
  ]
  const visibleActions = computed(() =>
    actions.filter(
      (action) =>
        !['production_in', 'sales_out'].includes(action.type) || hasAuth('WmsStockOperation:View')
    )
  )

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

<style scoped>
  .storage-action__icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-right: 10px;
    font-size: 18px;
    background: var(--el-color-primary-light-9);
    border-radius: var(--el-border-radius-base);
  }

  .storage-action__label {
    min-width: 0;
    line-height: 1.4;
  }
</style>
