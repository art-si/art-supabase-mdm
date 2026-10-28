<template>
  <ArtDialog ref="dialogRef" size="lg">
    <ElAlert
      v-if="!eligibleOrders.length"
      class="mb-4"
      title="当前仓库没有可领料的工单，请检查工单类型的领料仓库范围。"
      type="info"
      show-icon
      :closable="false"
    />
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
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { ElMessage } from 'element-plus'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtMaterialSelect from '@/components/business/art-material-select/index.vue'
  import type { MaterialSelectRecord } from '@/components/business/art-material-select/types'
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
  const eligibleOrders = computed(() =>
    orders.value.filter((order) =>
      order.allowedIssueWarehouseTypes.includes(context.value?.warehouse.warehouseType ?? '')
    )
  )
  const selectedMaterial = ref<MaterialSelectRecord[]>([])
  const form = ref({
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
      options: eligibleOrders.value.map((order) => ({
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
  const materialApi = ({ keyword, page, pageSize }: DataSelectFetchParams) => {
    const tenantId = context.value?.warehouse.tenantId
    if (!tenantId) return { data: [], total: 0 }
    return fetchStorageMaterialsPage(tenantId, keyword, page, pageSize)
  }
  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!context.value) return false
      await saveInventoryReservation(context.value.warehouse.tenantId, {
        ...form.value,
        binId: form.value.binId || null,
        remark: normalizeNullableText(form.value.remark)
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '库存预留保存失败，请检查填写内容和网络后重试')
      return false
    }
  }
  async function handleOpen(data: ReservationDialogContext): Promise<void> {
    if (!data.warehouse.businessScopes.includes('picking')) {
      ElMessage.warning('该仓库未启用拣货，不能预留原料')
      return
    }
    context.value = data
    Object.assign(form.value, {
      workOrderId: '',
      materialId: '',
      warehouseId: data.warehouse.id,
      binId: null,
      reservedQuantity: 1,
      remark: ''
    })
    selectedMaterial.value = []
    bins.value = []
    orders.value = []
    await dialogRef.value?.handleOpen(data, {
      title: '新增库存预留',
      subtitle: `${data.warehouse.warehouseName} · 工单原料锁定`,
      loading: true,
      loadingText: '正在加载库位与工单…',
      onConfirm: submit,
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          const [binRows, orderRows] = await Promise.all([
            fetchStorageBins(data.warehouse.id),
            fetchStorageWorkOrders(data.warehouse.id)
          ])
          bins.value = binRows
          orders.value = orderRows
        } catch {
          ElMessage.warning('库位或工单加载失败，请关闭弹窗后重试')
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
