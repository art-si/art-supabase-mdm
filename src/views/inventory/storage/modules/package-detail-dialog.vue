<template>
  <ArtDialog
    :loading="loading"
    ref="dialogRef"
    size="xl"
    :show-cancel-button="false"
    confirm-text="关闭"
  >
    <ArtSectionCard
      :title="pack?.packNo || '包内板材'"
      :subtitle="`${pack?.workOrderNo || ''} · 与 MES 排包主表及包明细共用`"
      :error="error"
      :empty="!loading && !error && !items.length"
      empty-title="包内暂无板材明细"
      empty-description="排包明细生成后可在此核对板材。"
      @retry="load"
    >
      <ArtTable
        :data="items"
        :columns="columns"
        :pagination="false"
        row-key="id"
        table-layout="fixed"
        :max-height="420"
      />
    </ArtSectionCard>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    fetchInventoryPackageItems,
    type InventoryPackage,
    type InventoryPackageItem
  } from '@mdm/api'

  const dialogRef = ref<ArtDialogExpose<InventoryPackage>>()
  const pack = shallowRef<InventoryPackage>()
  const items = ref<InventoryPackageItem[]>([])
  const loading = ref(false)
  const error = ref('')
  const columns: ColumnOption<InventoryPackageItem>[] = [
    {
      prop: 'number',
      label: '板材编号',
      minWidth: 150,
      formatter: (row) => row.number || row.boardId
    },
    { prop: 'pieces', label: '片数', minWidth: 90, align: 'right' },
    { prop: 'lengthMm', label: '长度 mm', minWidth: 105, align: 'right' },
    { prop: 'widthMm', label: '宽度 mm', minWidth: 105, align: 'right' },
    { prop: 'thicknessMm', label: '厚度 mm', minWidth: 105, align: 'right' },
    { prop: 'areaSqm', label: '面积 ㎡', minWidth: 100, align: 'right' },
    { prop: 'remark', label: '备注', minWidth: 150, formatter: (row) => row.remark || '—' }
  ]
  async function load(): Promise<void> {
    if (!pack.value) return
    loading.value = true
    error.value = ''
    try {
      items.value = await fetchInventoryPackageItems(pack.value.id)
    } catch {
      error.value = '包内板材明细加载失败，请重试。'
    } finally {
      loading.value = false
    }
  }
  async function handleOpen(data: InventoryPackage): Promise<void> {
    pack.value = data
    await dialogRef.value?.handleOpen(data, { title: `${data.packNo} · 包内明细` })
    await load()
  }
  defineExpose({ handleOpen })
</script>
