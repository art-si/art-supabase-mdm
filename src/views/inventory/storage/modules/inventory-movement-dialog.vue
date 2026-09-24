<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="space-y-4">
      <ArtEntitySummary
        icon="ri:swap-2-line"
        eyebrow="INVENTORY MOVEMENT"
        :title="movementLabel"
        :description="context.label"
      />
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="formItems"
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
            :api-fn="materialApi"
            :selected-data="selectedMaterial"
            title="选择入库物料"
            @update:model-value="form.materialId = $event || null"
            subtitle="仅显示当前仓库所属租户的已启用物料"
            @update:selected-data="selectedMaterial = $event"
          />
        </template>
      </ArtForm>
      <ElAlert
        v-if="!isInbound && !batchOptions.length"
        title="当前范围暂无可用批次。请先入库，或切换仓库、库区、库位。"
        type="info"
        :closable="false"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtMaterialSelect from '@/components/business/art-material-select/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchInventoryBatches,
    fetchStorageBins,
    fetchStorageMaterialsPage,
    fetchStorageWarehouses,
    fetchStorageWorkOrders,
    postInventoryMovement,
    type InventoryBatch,
    type InventoryMovementInput,
    type StorageBin,
    type StorageWarehouse,
    type StorageWorkOrder
  } from '@mdm/api'
  import type { MaterialSelectRecord } from '@/components/business/art-material-select/index.vue'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import type { StorageActionContext } from './storage-action-dialog.vue'

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<StorageActionContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  void userStore.ensureDictLoaded('mdmInventoryMovementType')
  const context = reactive<StorageActionContext>({ warehouseId: '', tenantId: '', label: '' })
  const form = reactive<InventoryMovementInput>({
    movementType: 'purchase_in',
    quantity: 1
  })
  const sourceBins = ref<StorageBin[]>([])
  const targetBins = ref<StorageBin[]>([])
  const warehouses = ref<StorageWarehouse[]>([])
  const workOrders = ref<StorageWorkOrder[]>([])
  const batchOptions = ref<InventoryBatch[]>([])
  const selectedMaterial = ref<MaterialSelectRecord[]>([])
  const isInbound = computed(() => form.movementType.endsWith('_in'))
  const movementLabel = computed(
    () =>
      getDictMap.value.mdmInventoryMovementType?.find((item) => item.value === form.movementType)
        ?.label || '库存业务'
  )
  const currentWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === context.warehouseId)
  )
  const targetWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === form.targetWarehouseId)
  )
  const availableSourceBins = computed(() =>
    context.zoneId
      ? sourceBins.value.filter((bin) => bin.zoneId === context.zoneId)
      : sourceBins.value
  )
  const sourceBinOptions = computed(() =>
    availableSourceBins.value
      .filter((bin) => bin.status === 'available')
      .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id }))
  )
  const targetBinOptions = computed(() =>
    targetBins.value
      .filter((bin) => bin.status === 'available')
      .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id }))
  )
  const formItems = computed<FormItem[]>(() => [
    { key: 'identity', label: '业务信息', type: 'divider', span: 24 },
    {
      label: '业务类型',
      key: 'movementType',
      type: 'select',
      options: getDictMap.value.mdmInventoryMovementType ?? [],
      props: { disabled: true }
    },
    {
      label: '业务单号',
      key: 'referenceNo',
      type: 'input',
      props: { maxlength: 80, placeholder: '采购单、销售单或内部单号' }
    },
    ...(isInbound.value
      ? [
          { label: '物料', key: 'materialId', type: 'slot' as const, span: 24 },
          {
            label: '批号',
            key: 'batchNo',
            type: 'input' as const,
            props: { maxlength: 80, placeholder: '填写供应商批号或生产批号' }
          },
          {
            label: '单位成本（元）',
            key: 'unitCost',
            type: 'number' as const,
            props: { min: 0, precision: 4, class: 'w-full!' },
            help: '可暂不核价；未核价批次将在统计中明确标记。'
          }
        ]
      : [
          {
            label: '来源批次',
            key: 'batchId',
            type: 'select' as const,
            span: 24,
            options: batchOptions.value.map((batch) => ({
              label: `${batch.material?.materialName || '物料'} · ${batch.batchNo} · ${batch.bin?.binCode || '仓库直存'} · 余 ${batch.quantity}`,
              value: batch.id
            })),
            props: { filterable: true, placeholder: '选择当前范围的在库批次' }
          }
        ]),
    {
      label: '数量',
      key: 'quantity',
      type: 'number',
      props: { min: 0.001, precision: 3, class: 'w-full!' }
    },
    ...(isInbound.value
      ? [
          {
            label: '面积（㎡）',
            key: 'areaSqm',
            type: 'number' as const,
            props: { min: 0, precision: 3, class: 'w-full!' }
          },
          {
            label: '长度（mm）',
            key: 'lengthMm',
            type: 'number' as const,
            props: { min: 0.001, precision: 3, class: 'w-full!' }
          },
          {
            label: '宽度（mm）',
            key: 'widthMm',
            type: 'number' as const,
            props: { min: 0.001, precision: 3, class: 'w-full!' }
          },
          {
            label: '厚度（mm）',
            key: 'thicknessMm',
            type: 'number' as const,
            props: { min: 0.001, precision: 3, class: 'w-full!' }
          }
        ]
      : []),
    ...(isInbound.value && currentWarehouse.value?.enableLocations
      ? [
          {
            label: '入库库位',
            key: 'binId',
            type: 'select' as const,
            options: sourceBinOptions.value,
            props: { filterable: true, disabled: Boolean(context.binId), placeholder: '选择库位' }
          }
        ]
      : []),
    ...(form.movementType === 'transfer'
      ? [
          {
            label: '目标仓库',
            key: 'targetWarehouseId',
            type: 'select' as const,
            options: warehouses.value
              .filter(
                (warehouse) =>
                  warehouse.tenantId === context.tenantId && warehouse.status === 'enabled'
              )
              .map((warehouse) => ({
                label: `${warehouse.warehouseName} · ${warehouse.warehouseCode}`,
                value: warehouse.id
              })),
            props: { filterable: true, placeholder: '选择目标仓库' }
          },
          ...(targetWarehouse.value?.enableLocations
            ? [
                {
                  label: '目标库位',
                  key: 'targetBinId',
                  type: 'select' as const,
                  options: targetBinOptions.value,
                  props: { filterable: true, placeholder: '选择目标库位' }
                }
              ]
            : [])
        ]
      : []),
    {
      label: '关联工单',
      key: 'workOrderId',
      type: 'select',
      options: workOrders.value.map((order) => ({
        label: `${order.workOrderNo}${order.constructionNo ? ` · ${order.constructionNo}` : ''}`,
        value: order.id
      })),
      props: { clearable: true, filterable: true, placeholder: '按需关联工单' }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500, showWordLimit: true }
    }
  ])
  const rules = computed(() => ({
    materialId: isInbound.value
      ? [{ required: true, message: '请选择物料', trigger: 'change' }]
      : [],
    batchNo: isInbound.value ? [{ required: true, message: '请输入批号', trigger: 'blur' }] : [],
    batchId: !isInbound.value
      ? [{ required: true, message: '请选择来源批次', trigger: 'change' }]
      : [],
    quantity: [
      {
        required: true,
        type: 'number' as const,
        min: 0.001,
        message: '请输入大于零的数量',
        trigger: 'change'
      }
    ],
    binId:
      isInbound.value && currentWarehouse.value?.enableLocations
        ? [{ required: true, message: '请选择入库库位', trigger: 'change' }]
        : [],
    targetWarehouseId:
      form.movementType === 'transfer'
        ? [{ required: true, message: '请选择目标仓库', trigger: 'change' }]
        : [],
    targetBinId:
      form.movementType === 'transfer' && targetWarehouse.value?.enableLocations
        ? [{ required: true, message: '请选择目标库位', trigger: 'change' }]
        : []
  }))

  const materialApi = async ({ keyword, page, pageSize }: DataSelectFetchParams) => {
    const result = await fetchStorageMaterialsPage(context.tenantId, keyword, page, pageSize)
    return {
      data: result.data.map((material) => ({
        id: material.id,
        materialCode: material.materialCode,
        materialName: material.materialName,
        specificationModel: material.specificationModel,
        description: material.description
      })),
      total: result.total
    }
  }

  watch(
    () => form.targetWarehouseId,
    async (id) => {
      form.targetBinId = null
      targetBins.value = id ? await fetchStorageBins(id) : []
    }
  )

  async function submit(): Promise<boolean> {
    try {
      await formRef.value?.validate()
      await postInventoryMovement({
        ...form,
        warehouseId: isInbound.value ? context.warehouseId : undefined,
        binId: isInbound.value ? (form.binId ?? null) : undefined,
        targetWarehouseId: form.movementType === 'transfer' ? form.targetWarehouseId : undefined,
        targetBinId: form.movementType === 'transfer' ? (form.targetBinId ?? null) : undefined
      })
      emit('success')
      return true
    } catch {
      return false
    }
  }

  async function handleOpen(type: string, data: StorageActionContext): Promise<void> {
    Object.assign(context, { zoneId: undefined, binId: undefined }, data)
    Object.assign(form, {
      movementType: type,
      quantity: 1,
      areaSqm: null,
      unitCost: null,
      materialId: null,
      warehouseId: data.warehouseId,
      binId: data.binId ?? null,
      targetWarehouseId: data.warehouseId,
      targetBinId: null,
      batchId: data.batchId ?? null,
      workOrderId: null,
      packId: null,
      batchNo: '',
      referenceNo: '',
      remark: '',
      lengthMm: null,
      widthMm: null,
      thicknessMm: null
    })
    selectedMaterial.value = []
    warehouses.value = []
    sourceBins.value = []
    workOrders.value = []
    targetBins.value = []
    batchOptions.value = []
    await dialogRef.value?.handleOpen(data, {
      title: `${movementLabel.value} · ${data.label}`,
      subtitle: '库存数量和业务流水将同步更新',
      loading: true,
      loadingText: '正在加载仓库、库位与库存批次…',
      onConfirm: submit,
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          const [warehouseRows, binRows, orderRows] = await Promise.all([
            fetchStorageWarehouses(),
            fetchStorageBins(data.warehouseId),
            fetchStorageWorkOrders(data.warehouseId)
          ])
          warehouses.value = warehouseRows
          sourceBins.value = binRows
          workOrders.value = orderRows
          targetBins.value = binRows
          batchOptions.value = isInbound.value
            ? []
            : (
                await fetchInventoryBatches({
                  warehouseId: data.warehouseId,
                  binId: data.binId,
                  zoneBinIds: data.zoneId
                    ? binRows.filter((bin) => bin.zoneId === data.zoneId).map((bin) => bin.id)
                    : undefined,
                  positiveOnly: true,
                  current: 1,
                  size: 100
                })
              ).data
        } catch {
          ElMessage.warning('库存基础数据加载失败，请关闭弹窗后重试')
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
