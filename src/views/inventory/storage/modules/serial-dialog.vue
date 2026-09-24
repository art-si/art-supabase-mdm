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
          :disabled="Boolean(context?.row)"
          title="选择序列号物料"
          subtitle="物料描述、规格型号、来源与类型直接引用物料主数据。"
          @update:model-value="form.materialId = $event || ''"
          @update:selected-data="selectedMaterial = $event"
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { normalizeNullableText } from '@/utils/form/normalize'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtMaterialSelect, {
    type MaterialSelectRecord
  } from '@/components/business/art-material-select/index.vue'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchStorageBins,
    fetchStorageMaterialsPage,
    fetchStorageWorkOrders,
    saveInventorySerial,
    type InventorySerial,
    type StorageBin,
    type StorageWarehouse,
    type StorageWorkOrder
  } from '@mdm/api'

  export interface SerialDialogContext {
    warehouse: StorageWarehouse
    row?: InventorySerial
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<SerialDialogContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const context = shallowRef<SerialDialogContext>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  void userStore.ensureDictLoaded('mdmInventorySerialStatus')
  const bins = ref<StorageBin[]>([])
  const orders = ref<StorageWorkOrder[]>([])
  const selectedMaterial = ref<MaterialSelectRecord[]>([])
  const transitions: Record<string, string[]> = {
    pending_in: ['pending_in', 'in_stock'],
    in_stock: ['in_stock', 'pending_out', 'out', 'transfer_in_transit'],
    pending_out: ['pending_out', 'in_stock', 'out'],
    transfer_in_transit: ['transfer_in_transit', 'in_stock'],
    out: ['out', 'pending_in']
  }
  const form = reactive({
    serialNo: '',
    workOrderId: null as string | null,
    materialId: '',
    batchId: null as string | null,
    status: 'pending_in',
    warehouseId: null as string | null,
    binId: null as string | null,
    remark: null as string | null
  })
  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '序列号身份', type: 'divider', span: 24 },
    {
      key: 'serialNo',
      label: '序列号',
      type: 'input',
      props: {
        maxlength: 100,
        disabled: Boolean(context.value?.row),
        placeholder: '扫描或录入唯一序列号'
      }
    },
    {
      key: 'status',
      label: '序列号状态',
      type: 'select',
      options: (getDictMap.value.mdmInventorySerialStatus ?? []).filter((item) =>
        (transitions[context.value?.row?.status ?? 'pending_in'] ?? []).includes(item.value)
      )
    },
    { key: 'materialId', label: '物料', type: 'slot', span: 24 },
    {
      key: 'workOrderId',
      label: '工单',
      type: 'select',
      options: orders.value.map((order) => ({ label: order.workOrderNo, value: order.id })),
      props: { clearable: true, filterable: true, placeholder: '按需关联工单' }
    },
    {
      key: 'binId',
      label: '仓位',
      type: 'select',
      options: bins.value
        .filter((bin) => bin.supportsSerial && bin.status === 'available')
        .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id })),
      props: { clearable: true, filterable: true, placeholder: '选择支持 SN 的库位' },
      help: '在库状态且仓库启用仓位时必填。'
    },
    {
      key: 'remark',
      label: '备注',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500 }
    }
  ])
  const rules = {
    serialNo: [{ required: true, message: '请输入序列号', trigger: 'blur' }],
    materialId: [{ required: true, message: '请选择物料', trigger: 'change' }],
    status: [{ required: true, message: '请选择状态', trigger: 'change' }]
  }
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
      await saveInventorySerial(
        context.value.warehouse.tenantId,
        {
          ...form,
          serialNo: form.serialNo.trim(),
          remark: normalizeNullableText(form.remark)
        },
        context.value.row?.id
      )
      emit('success')
      return true
    } catch {
      return false
    }
  }
  async function handleOpen(data: SerialDialogContext): Promise<void> {
    context.value = data
    const row = data.row
    Object.assign(form, {
      serialNo: row?.serialNo ?? '',
      workOrderId: row?.workOrderId ?? null,
      materialId: row?.materialId ?? '',
      batchId: row?.batchId ?? null,
      status: row?.status ?? 'pending_in',
      warehouseId: data.warehouse.id,
      binId: row?.binId ?? null,
      remark: row?.remark ?? null
    })
    selectedMaterial.value = row
      ? [
          {
            id: row.materialId,
            materialCode: row.materialCode,
            materialName: row.materialName,
            specificationModel: row.specificationModel
          }
        ]
      : []
    bins.value = []
    orders.value = []
    await dialogRef.value?.handleOpen(data, {
      title: row ? '编辑序列号' : '新增序列号',
      subtitle: `${data.warehouse.warehouseName} · 序列号追踪`,
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
