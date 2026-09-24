<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="space-y-4">
      <ElAlert v-if="loadError" type="error" :closable="false" show-icon>
        <template #title>库位加载失败</template>
        <ElButton link type="primary" @click="loadBins">重新加载</ElButton>
      </ElAlert>
      <ArtEntitySummary
        icon="ri:archive-drawer-line"
        eyebrow="PACK PLACEMENT"
        :title="context?.pack.packNo || '垛包落位'"
        :description="`${context?.pack.workOrderNo || ''} · ${context?.pack.pieceCount || 0} 片板材`"
      />
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="items"
        :rules="rules"
        :span="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import {
    fetchStorageBins,
    placeInventoryPackage,
    type InventoryPackage,
    type StorageBin,
    type StorageWarehouse
  } from '@mdm/api'

  export interface PackagePlacementContext {
    pack: InventoryPackage
    warehouse: StorageWarehouse
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<PackagePlacementContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const context = shallowRef<PackagePlacementContext>()
  const bins = ref<StorageBin[]>([])
  const loadError = ref(false)
  const form = reactive({ binId: null as string | null })
  const items = computed<FormItem[]>(() =>
    context.value?.warehouse.enableLocations
      ? [
          {
            key: 'binId',
            label: '存放库位',
            type: 'select',
            options: bins.value
              .filter((bin) => bin.status === 'available')
              .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id })),
            props: { filterable: true, placeholder: '选择库位' }
          }
        ]
      : [{ key: 'warehouse', label: '当前仓库未启用仓位，垛包将直接归属仓库。', type: 'divider' }]
  )
  const rules = computed(() => ({
    binId: context.value?.warehouse.enableLocations
      ? [{ required: true, message: '请选择存放库位', trigger: 'change' }]
      : []
  }))
  async function submit(): Promise<boolean> {
    if (loadError.value) return false
    try {
      await formRef.value?.validate()
      if (!context.value) return false
      await placeInventoryPackage(
        context.value.warehouse.tenantId,
        context.value.pack.id,
        context.value.warehouse.id,
        form.binId
      )
      emit('success')
      return true
    } catch {
      return false
    }
  }
  async function loadBins(): Promise<void> {
    if (!context.value?.warehouse.enableLocations) return
    const warehouseId = context.value.warehouse.id
    loadError.value = false
    dialogRef.value?.setLoading(true)
    try {
      const loadedBins = await fetchStorageBins(warehouseId)
      if (context.value?.warehouse.id === warehouseId) bins.value = loadedBins
    } catch {
      loadError.value = true
    } finally {
      dialogRef.value?.setLoading(false)
    }
  }
  async function handleOpen(data: PackagePlacementContext): Promise<void> {
    context.value = data
    form.binId = data.pack.binId
    bins.value = []
    loadError.value = false
    await dialogRef.value?.handleOpen(data, {
      title: data.pack.placementId ? '调整垛包落位' : '垛包落位',
      subtitle: data.warehouse.warehouseName,
      loading: data.warehouse.enableLocations,
      loadingText: '正在加载可用库位…',
      onConfirm: submit,
      onOpen: async () => {
        formRef.value?.clearValidate()
        await loadBins()
      }
    })
  }
  defineExpose({ handleOpen })
</script>
