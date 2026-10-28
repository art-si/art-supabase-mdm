<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="space-y-4">
      <ArtEntitySummary
        icon="ri:swap-2-line"
        eyebrow="INVENTORY MOVEMENT"
        :title="movementLabel"
        :description="inboundDestinationDescription"
      />
      <ElAlert
        v-if="inboundWarehouseError"
        :title="inboundWarehouseError"
        type="warning"
        :closable="false"
      />
      <ArtForm
        ref="formRef"
        :model-value="form"
        @update:model-value="replaceReactiveModel(form, $event)"
        :items="formItems"
        :rules="rules"
        :span="12"
        :gutter="20"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #movementType>
          <ArtDictDisplay
            dict-code="mdmInventoryMovementType"
            :value="form.movementType"
            display="text"
          />
        </template>
        <template #materialId>
          <ArtMaterialSelect
            :model-value="form.materialId || undefined"
            :api-fn="materialApi"
            :selected-data="selectedMaterial"
            title="选择入库物料"
            @update:model-value="form.materialId = $event || null"
            subtitle="仅显示当前仓库所属租户的已启用物料"
            @update:selected-data="handleMaterialSelection"
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
  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtMaterialSelect from '@/components/business/art-material-select/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchInventoryBatches,
    fetchStorageBins,
    fetchStorageMaterialsPage,
    fetchStorageWarehouses,
    fetchStorageWorkOrders,
    fetchStorageZones,
    postInventoryMovement,
    type InventoryBatch,
    type InventoryMovementInput,
    type StorageBin,
    type StorageWarehouse,
    type StorageWorkOrder,
    type StorageZone
  } from '@mdm/api'
  import type { MaterialSelectRecord } from '@/components/business/art-material-select/types'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import type { StorageActionContext } from './storage-action-dialog.vue'

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<StorageActionContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const userStore = useUserStore()
  const context = reactive<StorageActionContext>({ warehouseId: '', tenantId: '', label: '' })
  const form = reactive<InventoryMovementInput>({
    movementType: 'purchase_in',
    quantity: 1
  })
  const sourceBins = ref<StorageBin[]>([])
  const targetBins = ref<StorageBin[]>([])
  const sourceZones = ref<StorageZone[]>([])
  const targetZones = ref<StorageZone[]>([])
  const warehouses = ref<StorageWarehouse[]>([])
  const workOrders = ref<StorageWorkOrder[]>([])
  const batchOptions = ref<InventoryBatch[]>([])
  type StorageMaterialSelectRecord = MaterialSelectRecord & { inboundWarehouseId?: string | null }
  const selectedMaterial = ref<StorageMaterialSelectRecord[]>([])
  const inboundWarehouseError = ref('')
  let destinationRevision = 0
  const isInbound = computed(() => form.movementType.endsWith('_in'))
  const movementLabel = computed(() =>
    userStore.getDictDisplayLabelByValue('mdmInventoryMovementType', form.movementType, '库存业务')
  )
  const currentWarehouse = computed(() =>
    warehouses.value.find(
      (warehouse) => warehouse.id === (isInbound.value ? form.warehouseId : context.warehouseId)
    )
  )
  const inboundDestinationDescription = computed(() =>
    form.movementType === 'production_in'
      ? currentWarehouse.value
        ? `入库目标：${currentWarehouse.value.warehouseName} · ${currentWarehouse.value.warehouseCode}`
        : '选择成品物料后自动确定入库仓库'
      : context.label
  )
  const eligibleFinishedWarehouses = computed(() =>
    warehouses.value.filter(
      (warehouse) =>
        warehouse.tenantId === context.tenantId &&
        warehouse.status === 'enabled' &&
        warehouse.warehouseType === 'finished' &&
        warehouse.businessScopes.length > 0
    )
  )
  const targetWarehouse = computed(() =>
    warehouses.value.find((warehouse) => warehouse.id === form.targetWarehouseId)
  )
  const availableSourceBins = computed(() =>
    currentWarehouse.value?.enableZones
      ? sourceBins.value.filter((bin) => bin.zoneId === form.zoneId)
      : sourceBins.value
  )
  const sourceBinOptions = computed(() =>
    availableSourceBins.value
      .filter((bin) => bin.status === 'available')
      .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id }))
  )
  const targetBinOptions = computed(() =>
    targetBins.value
      .filter(
        (bin) =>
          bin.status === 'available' &&
          (!targetWarehouse.value?.enableZones || bin.zoneId === form.targetZoneId)
      )
      .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id }))
  )
  const formItems = computed<FormItem[]>(() => [
    { key: 'identity', label: '业务信息', type: 'divider', span: 24 },
    {
      label: '业务类型',
      key: 'movementType',
      type: 'slot'
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
              label: `${batch.material?.materialName || '物料'} · ${batch.batchNo} · ${batch.bin?.binCode || batch.zone?.zoneName || '仓库直存'} · 余 ${batch.quantity}`,
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
    ...(form.movementType === 'production_in'
      ? [
          {
            label: '入库仓库',
            key: 'warehouseId',
            type: 'select' as const,
            options: warehouses.value
              .filter((warehouse) => warehouse.tenantId === context.tenantId)
              .map((warehouse) => ({
                label: `${warehouse.warehouseName} · ${warehouse.warehouseCode}`,
                value: warehouse.id
              })),
            props: { disabled: true, placeholder: '选择物料后自动确定入库仓库' }
          }
        ]
      : []),
    ...(isInbound.value && currentWarehouse.value?.enableZones
      ? [
          {
            label: '入库库区',
            key: 'zoneId',
            type: 'select' as const,
            options: sourceZones.value
              .filter((zone) => zone.status === 'enabled' && !zone.abnormal)
              .map((zone) => ({ label: `${zone.zoneName} · ${zone.zoneCode}`, value: zone.id })),
            props: {
              clearable: !currentWarehouse.value.enableLocations,
              filterable: true,
              placeholder: currentWarehouse.value.enableLocations
                ? '请选择库区'
                : '不选则存放在仓库',
              onChange: () => {
                form.binId = null
              }
            }
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
            props: {
              filterable: true,
              disabled: Boolean(context.binId && form.warehouseId === context.warehouseId),
              placeholder: '选择库位'
            }
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
          ...(targetWarehouse.value?.enableZones
            ? [
                {
                  label: '目标库区',
                  key: 'targetZoneId',
                  type: 'select' as const,
                  options: targetZones.value
                    .filter((zone) => zone.status === 'enabled' && !zone.abnormal)
                    .map((zone) => ({
                      label: `${zone.zoneName} · ${zone.zoneCode}`,
                      value: zone.id
                    })),
                  props: {
                    clearable: !targetWarehouse.value.enableLocations,
                    filterable: true,
                    placeholder: targetWarehouse.value.enableLocations
                      ? '请选择库区'
                      : '不选则存放在仓库',
                    onChange: () => {
                      form.targetBinId = null
                    }
                  }
                }
              ]
            : []),
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
    warehouseId:
      form.movementType === 'production_in'
        ? [{ required: true, message: '请先配置可用于成品入库的仓库', trigger: 'change' }]
        : [],
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
    zoneId:
      isInbound.value &&
      currentWarehouse.value?.enableLocations &&
      currentWarehouse.value.enableZones
        ? [{ required: true, message: '请选择入库库区', trigger: 'change' }]
        : [],
    targetWarehouseId:
      form.movementType === 'transfer'
        ? [{ required: true, message: '请选择目标仓库', trigger: 'change' }]
        : [],
    targetBinId:
      form.movementType === 'transfer' && targetWarehouse.value?.enableLocations
        ? [{ required: true, message: '请选择目标库位', trigger: 'change' }]
        : [],
    targetZoneId:
      form.movementType === 'transfer' &&
      targetWarehouse.value?.enableLocations &&
      targetWarehouse.value.enableZones
        ? [{ required: true, message: '请选择目标库区', trigger: 'change' }]
        : []
  }))

  const materialApi = ({ keyword, page, pageSize }: DataSelectFetchParams) =>
    fetchStorageMaterialsPage(context.tenantId, keyword, page, pageSize)

  async function handleMaterialSelection(rows: MaterialSelectRecord[]): Promise<void> {
    selectedMaterial.value = rows
    if (form.movementType !== 'production_in') return
    const revision = ++destinationRevision
    const material = selectedMaterial.value[0]
    if (material?.materialType !== 'FERT') {
      inboundWarehouseError.value = ''
      form.warehouseId = context.warehouseId
      form.zoneId = context.zoneId ?? null
      form.binId = context.binId ?? null
      const [bins, zones] = await Promise.all([
        fetchStorageBins(context.warehouseId),
        fetchStorageZones(context.warehouseId)
      ])
      if (revision === destinationRevision) {
        sourceBins.value = bins
        sourceZones.value = zones
      }
      return
    }
    const finishedWarehouses = eligibleFinishedWarehouses.value
    const preferred = finishedWarehouses.find(
      (warehouse) => warehouse.id === material.inboundWarehouseId
    )
    const destination =
      preferred ?? (finishedWarehouses.length === 1 ? finishedWarehouses[0] : null)
    if (!destination) {
      inboundWarehouseError.value = finishedWarehouses.length
        ? '存在多个成品仓，请先在物料主数据中指定入库仓库。'
        : '暂无可用于业务的成品仓，请先启用成品仓并配置入库仓库。'
      form.warehouseId = null
      form.zoneId = null
      form.binId = null
      sourceBins.value = []
      sourceZones.value = []
      return
    }
    inboundWarehouseError.value = ''
    form.warehouseId = destination.id
    form.zoneId = destination.id === context.warehouseId ? (context.zoneId ?? null) : null
    form.binId = destination.id === context.warehouseId ? (context.binId ?? null) : null
    const [bins, zones] = await Promise.all([
      fetchStorageBins(destination.id),
      fetchStorageZones(destination.id)
    ])
    if (revision === destinationRevision) {
      sourceBins.value = bins
      sourceZones.value = zones
    }
  }

  watch(
    () => form.targetWarehouseId,
    async (id) => {
      form.targetBinId = null
      form.targetZoneId = null
      const [bins, zones] = id
        ? await Promise.all([fetchStorageBins(id), fetchStorageZones(id)])
        : [[], []]
      targetBins.value = bins
      targetZones.value = zones
    }
  )

  async function submit(): Promise<boolean> {
    if (inboundWarehouseError.value) return false
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '库存移动校验未完成，请稍后重试', 'warning')
      return false
    }
    try {
      await postInventoryMovement({
        ...form,
        warehouseId: isInbound.value ? form.warehouseId : undefined,
        zoneId: isInbound.value ? (form.zoneId ?? null) : undefined,
        binId: isInbound.value ? (form.binId ?? null) : undefined,
        targetWarehouseId: form.movementType === 'transfer' ? form.targetWarehouseId : undefined,
        targetZoneId: form.movementType === 'transfer' ? (form.targetZoneId ?? null) : undefined,
        targetBinId: form.movementType === 'transfer' ? (form.targetBinId ?? null) : undefined
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '库存移动提交失败，请检查库存数量和库位后重试')
      return false
    }
  }

  async function handleOpen(type: string, data: StorageActionContext): Promise<void> {
    const openingRevision = ++destinationRevision
    inboundWarehouseError.value = ''
    Object.assign(context, { zoneId: undefined, binId: undefined }, data)
    Object.assign(form, {
      movementType: type,
      quantity: 1,
      areaSqm: null,
      unitCost: null,
      materialId: null,
      warehouseId: type === 'production_in' ? null : data.warehouseId,
      zoneId: type === 'production_in' ? null : (data.zoneId ?? null),
      binId: type === 'production_in' ? null : (data.binId ?? null),
      targetWarehouseId: data.warehouseId,
      targetZoneId: null,
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
    sourceZones.value = []
    workOrders.value = []
    targetBins.value = []
    targetZones.value = []
    batchOptions.value = []
    await dialogRef.value?.handleOpen(data, {
      title:
        type === 'production_in' ? movementLabel.value : `${movementLabel.value} · ${data.label}`,
      subtitle: '库存数量和业务流水将同步更新',
      loading: true,
      loadingText: '正在加载仓库、库位与库存批次…',
      onConfirm: submit,
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          const [warehouseRows, binRows, zoneRows, orderRows] = await Promise.all([
            fetchStorageWarehouses(),
            fetchStorageBins(data.warehouseId),
            fetchStorageZones(data.warehouseId),
            fetchStorageWorkOrders(data.warehouseId),
            userStore.ensureDictLoaded('mdmInventoryMovementType')
          ])
          if (openingRevision !== destinationRevision || !api.visible.value) return
          warehouses.value = warehouseRows
          sourceBins.value = binRows
          sourceZones.value = zoneRows
          workOrders.value = orderRows
          targetBins.value = binRows
          targetZones.value = zoneRows
          const batches = isInbound.value
            ? []
            : (
                await fetchInventoryBatches({
                  warehouseId: data.warehouseId,
                  binId: data.binId,
                  zoneId: data.zoneId,
                  positiveOnly: true,
                  current: 1,
                  size: 100
                })
              ).data
          if (openingRevision !== destinationRevision || !api.visible.value) return
          batchOptions.value = batches
          api.setOptions({
            title:
              type === 'production_in'
                ? movementLabel.value
                : `${movementLabel.value} · ${data.label}`
          })
        } catch {
          if (openingRevision === destinationRevision && api.visible.value) {
            ElMessage.warning('库存基础数据加载失败，请关闭弹窗后重试')
          }
        } finally {
          if (openingRevision === destinationRevision && api.visible.value) {
            api.setLoading(false)
          }
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
