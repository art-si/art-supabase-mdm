<template>
  <ArtDialog ref="dialogRef" size="lg">
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="20"
      label-position="top"
      :show-reset="false"
      :show-submit="false"
    >
      <template #materialId>
        <ArtMaterialSelect
          :model-value="form.materialId || undefined"
          :selected-data="selectedMaterial"
          :api-fn="materialApi"
          title="选择预留物料"
          subtitle="从当前仓库所属租户的物料主数据中选择"
          @update:model-value="form.materialId = $event || ''"
          @update:selected-data="selectedMaterial = $event"
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtMaterialSelect, {
    type MaterialSelectRecord
  } from '@/components/business/art-material-select/index.vue'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import {
    fetchStorageBins,
    fetchStorageMaterialsPage,
    fetchStorageWorkOrders,
    saveInventoryReservation,
    type StorageBin,
    type StorageWarehouse,
    type StorageWorkOrder
  } from '@mdm/api'

  export interface ReservationDialogContext {
    warehouse: StorageWarehouse
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ReservationDialogContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const context = shallowRef<ReservationDialogContext>()
  const bins = ref<StorageBin[]>([])
  const orders = ref<StorageWorkOrder[]>([])
  const selectedMaterial = ref<MaterialSelectRecord[]>([])
  const form = reactive({
    workOrderId: '',
    materialId: '',
    warehouseId: '',
    binId: null as string | null,
    reservedQuantity: 1,
    remark: ''
  })
  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '工单锁料', type: 'divider', span: 24 },
    {
      key: 'workOrderId',
      label: '工单',
      type: 'select',
      options: orders.value.map((order) => ({
        label: `${order.workOrderNo}${order.constructionNo ? ` · ${order.constructionNo}` : ''}`,
        value: order.id
      })),
      props: { filterable: true, placeholder: '选择工单' }
    },
    {
      key: 'reservedQuantity',
      label: '预留数量',
      type: 'number',
      props: { min: 0.001, precision: 3, class: 'w-full!' }
    },
    { key: 'materialId', label: '原料物料', type: 'slot', span: 24 },
    ...(context.value?.warehouse.enableLocations
      ? [
          {
            key: 'binId',
            label: '预留库位',
            type: 'select' as const,
            options: bins.value
              .filter((bin) => bin.status === 'available')
              .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id })),
            props: { filterable: true, placeholder: '选择有库存的库位' }
          }
        ]
      : []),
    {
      key: 'remark',
      label: '备注',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500 }
    }
  ])
  const rules = computed(() => ({
    workOrderId: [{ required: true, message: '请选择工单', trigger: 'change' }],
    materialId: [{ required: true, message: '请选择原料物料', trigger: 'change' }],
    reservedQuantity: [
      {
        required: true,
        type: 'number' as const,
        min: 0.001,
        message: '请输入大于零的数量',
        trigger: 'change'
      }
    ],
    binId: context.value?.warehouse.enableLocations
      ? [{ required: true, message: '请选择预留库位', trigger: 'change' }]
      : []
  }))
  const materialApi = async ({ keyword, page, pageSize }: DataSelectFetchParams) => {
    const tenantId = context.value?.warehouse.tenantId
    if (!tenantId) return { data: [], total: 0 }
    const result = await fetchStorageMaterialsPage(tenantId, keyword, page, pageSize)
    return {
      data: result.data.map((material) => ({
        id: material.id,
        materialCode: material.materialCode,
        materialName: material.materialName,
        specificationModel: material.specificationModel
      })),
      total: result.total
    }
  }
  async function submit(): Promise<boolean> {
    try {
      await formRef.value?.validate()
      if (!context.value) return false
      await saveInventoryReservation(context.value.warehouse.tenantId, {
        ...form,
        binId: form.binId || null,
        remark: form.remark.trim() || null
      })
      emit('success')
      return true
    } catch {
      return false
    }
  }
  async function handleOpen(data: ReservationDialogContext): Promise<void> {
    context.value = data
    Object.assign(form, {
      workOrderId: '',
      materialId: '',
      warehouseId: data.warehouse.id,
      binId: null,
      reservedQuantity: 1,
      remark: ''
    })
    selectedMaterial.value = []
    const [binRows, orderRows] = await Promise.all([
      fetchStorageBins(data.warehouse.id),
      fetchStorageWorkOrders(data.warehouse.id)
    ])
    bins.value = binRows
    orders.value = orderRows
    await dialogRef.value?.handleOpen(data, {
      title: '新增库存预留',
      subtitle: `${data.warehouse.warehouseName} · 工单原料锁定`,
      onConfirm: submit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }
  defineExpose({ handleOpen })
</script>
