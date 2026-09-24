<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="space-y-4">
      <ElAlert v-if="loadError" type="error" :closable="false" show-icon>
        <template #title>库存口径加载失败</template>
        <ElButton link type="primary" @click="loadPolicy">重新加载</ElButton>
      </ElAlert>
      <p class="text-sm text-[var(--el-text-color-secondary)]">
        超过设定天数没有出入库活动的在库批次计为呆滞库存。该口径适用于当前租户的库区和库位统计。
      </p>
      <div class="flex items-center gap-3">
        <span class="shrink-0 text-sm">无活动天数</span>
        <ElInputNumber v-model="staleDays" :min="1" :max="3650" :step="1" :precision="0" />
        <span class="text-sm text-[var(--el-text-color-secondary)]">天</span>
      </div>
      <div class="rounded-lg border border-[var(--el-border-color)] p-3">
        <ElSwitch v-model="autoReserveOnRelease" active-text="工单下达时自动预留原料" />
        <p class="mt-2 text-xs text-[var(--el-text-color-secondary)]">
          开启后，按 BOM 需求从可拣货原料仓锁定库存；任一物料不足时阻止工单下达并提示缺口。
        </p>
      </div>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import { fetchInventoryPolicy, saveInventoryPolicy } from '@mdm/api'

  const emit = defineEmits<{ success: [staleDays: number] }>()
  const dialogRef = ref<ArtDialogExpose<{ tenantId: string; warehouseName: string }>>()
  const context = shallowRef<{ tenantId: string; warehouseName: string }>()
  const staleDays = ref(90)
  const autoReserveOnRelease = ref(true)
  const loadError = ref(false)

  async function loadPolicy(): Promise<void> {
    if (!context.value) return
    const tenantId = context.value.tenantId
    loadError.value = false
    dialogRef.value?.setLoading(true)
    try {
      const policy = await fetchInventoryPolicy(tenantId)
      if (context.value?.tenantId !== tenantId) return
      staleDays.value = policy.staleDays
      autoReserveOnRelease.value = policy.autoReserveOnRelease
    } catch {
      loadError.value = true
    } finally {
      dialogRef.value?.setLoading(false)
    }
  }

  async function submit(): Promise<boolean> {
    if (
      loadError.value ||
      !context.value ||
      !Number.isInteger(staleDays.value) ||
      staleDays.value < 1
    )
      return false
    try {
      await saveInventoryPolicy(context.value.tenantId, {
        staleDays: staleDays.value,
        autoReserveOnRelease: autoReserveOnRelease.value
      })
      emit('success', staleDays.value)
      return true
    } catch {
      return false
    }
  }

  async function handleOpen(data: { tenantId: string; warehouseName: string }): Promise<void> {
    context.value = data
    loadError.value = false
    await dialogRef.value?.handleOpen(data, {
      title: '配置呆滞库存口径',
      subtitle: `${data.warehouseName} · 当前租户`,
      loading: true,
      loadingText: '正在加载库存口径…',
      onConfirm: submit,
      onOpen: loadPolicy
    })
  }
  defineExpose({ handleOpen })
</script>
