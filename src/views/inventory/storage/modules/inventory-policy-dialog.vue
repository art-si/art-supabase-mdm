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
      <ArtForm v-model="form" :items="items" :span="24" label-position="top" root-class="p-0!" />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import { fetchInventoryPolicy, saveInventoryPolicy } from '@mdm/api'

  const emit = defineEmits<{ success: [staleDays: number] }>()
  const dialogRef = ref<ArtDialogExpose<{ tenantId: string; warehouseName: string }>>()
  const context = shallowRef<{ tenantId: string; warehouseName: string }>()
  const form = reactive({ staleDays: 90, autoReserveOnRelease: true })
  const items: FormItem[] = [
    {
      key: 'staleDays',
      label: '无活动天数（天）',
      type: 'number',
      props: { min: 1, max: 3650, step: 1, precision: 0, class: 'w-full!' }
    },
    {
      key: 'autoReserveOnRelease',
      label: '工单下达时自动预留原料',
      type: 'switch',
      description:
        '开启后，按 BOM 需求从可拣货原料仓锁定库存；任一物料不足时阻止工单下达并提示缺口。'
    }
  ]
  const loadError = ref(false)

  async function loadPolicy(): Promise<void> {
    if (!context.value) return
    const tenantId = context.value.tenantId
    loadError.value = false
    dialogRef.value?.setLoading(true)
    try {
      const policy = await fetchInventoryPolicy(tenantId)
      if (context.value?.tenantId !== tenantId) return
      form.staleDays = policy.staleDays
      form.autoReserveOnRelease = policy.autoReserveOnRelease
    } catch {
      loadError.value = true
    } finally {
      dialogRef.value?.setLoading(false)
    }
  }

  async function submit(): Promise<boolean> {
    if (loadError.value || !context.value) return false
    if (!Number.isInteger(form.staleDays) || form.staleDays < 1) {
      ElMessage.warning('无活动天数必须是大于零的整数')
      return false
    }
    try {
      await saveInventoryPolicy(context.value.tenantId, {
        staleDays: form.staleDays,
        autoReserveOnRelease: form.autoReserveOnRelease
      })
      emit('success', form.staleDays)
      return true
    } catch (error) {
      notifyFriendlyError(error, '呆滞库存口径保存失败，请检查当前租户和网络后重试')
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
