<template>
  <ArtDialog
    ref="dialogRef"
    size="xl"
    :show-cancel-button="false"
    confirm-text="关闭"
    content-max-height="76vh"
  >
    <ArtSectionCard
      title="当前库存"
      :subtitle="`${context.label} · 双击库区或库位可随时回到此明细`"
      :loading="loading"
      :error="error"
      :empty="!loading && !error && !rows.length"
      empty-title="暂无在库批次"
      empty-description="可从库区或库位的快捷菜单办理入库。"
      @retry="load"
    >
      <ArtTable
        :data="rows"
        :columns="columns"
        :pagination="pagination"
        row-key="id"
        table-layout="fixed"
        scrollbar-always-on
        :max-height="480"
        @pagination:current-change="changePage"
        @pagination:size-change="changeSize"
      />
    </ArtSectionCard>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import type { ColumnOption } from '@/types'
  import { fetchInventoryBatches, type InventoryBatch } from '@mdm/api'

  export interface InventoryDetailContext {
    warehouseId: string
    label: string
    binId?: string
    zoneBinIds?: string[]
  }

  const dialogRef = ref<ArtDialogExpose<InventoryDetailContext>>()
  const context = reactive<InventoryDetailContext>({ warehouseId: '', label: '' })
  const rows = ref<InventoryBatch[]>([])
  const loading = ref(false)
  const error = ref('')
  const pagination = reactive({ current: 1, size: 20, total: 0 })
  const columns: ColumnOption<InventoryBatch>[] = [
    {
      prop: 'materialId',
      label: '物料',
      minWidth: 230,
      formatter: (row) => (
        <div class="grid min-w-0">
          <strong class="truncate">{row.material?.materialName || '—'}</strong>
          <small class="truncate text-[var(--el-text-color-secondary)]">
            {row.material?.materialCode || row.materialId}
          </small>
        </div>
      )
    },
    { prop: 'batchNo', label: '批号', minWidth: 145, showOverflowTooltip: true },
    {
      prop: 'binId',
      label: '库位',
      minWidth: 120,
      formatter: (row) => row.bin?.binCode || '仓库直存'
    },
    { prop: 'quantity', label: '在库数量', minWidth: 105, align: 'right' },
    {
      prop: 'areaSqm',
      label: '面积 ㎡',
      minWidth: 100,
      align: 'right',
      formatter: (row) => row.areaSqm ?? '—'
    },
    {
      prop: 'unitCost',
      label: '单位成本',
      minWidth: 120,
      align: 'right',
      formatter: (row) => (row.unitCost === null ? '待核价' : formatCurrencyValue(row.unitCost))
    },
    {
      prop: 'amount',
      label: '库存金额',
      minWidth: 130,
      align: 'right',
      formatter: (row) =>
        row.unitCost === null ? '待核价' : formatCurrencyValue(row.quantity * row.unitCost)
    },
    {
      prop: 'lastMovementAt',
      label: '最后出入库',
      width: 170,
      formatter: (row) => dayjs(row.lastMovementAt).format('YYYY-MM-DD HH:mm')
    }
  ]

  async function load(): Promise<void> {
    if (!context.warehouseId) return
    loading.value = true
    error.value = ''
    try {
      const result = await fetchInventoryBatches({
        warehouseId: context.warehouseId,
        binId: context.binId,
        zoneBinIds: context.zoneBinIds,
        positiveOnly: true,
        current: pagination.current,
        size: pagination.size
      })
      rows.value = result.data
      pagination.total = result.total
    } catch {
      error.value = '库存明细加载失败，请重试。'
    } finally {
      loading.value = false
    }
  }

  function changePage(page: number): void {
    pagination.current = page
    void load()
  }
  function changeSize(size: number): void {
    pagination.current = 1
    pagination.size = size
    void load()
  }
  async function handleOpen(data: InventoryDetailContext): Promise<void> {
    Object.assign(
      context,
      { warehouseId: '', label: '', binId: undefined, zoneBinIds: undefined },
      data
    )
    pagination.current = 1
    await dialogRef.value?.handleOpen(data, { title: `${data.label} · 库存明细` })
    await load()
  }
  defineExpose({ handleOpen })
</script>
