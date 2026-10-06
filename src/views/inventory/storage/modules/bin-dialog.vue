<template>
  <ArtDialog ref="dialogRef" size="lg">
    <ArtForm
      ref="formRef"
      :model-value="form"
      @update:model-value="replaceReactiveModel(form, $event)"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="20"
      label-position="top"
      :show-reset="false"
      :show-submit="false"
    >
      <template #fixedMaterialId>
        <ArtMaterialSelect
          :model-value="form.fixedMaterialId || undefined"
          :selected-data="selectedMaterial"
          :api-fn="materialApi"
          title="选择定容物料"
          subtitle="指定后，该库位只能存放这一种物料，并须设置容量上限。"
          clearable
          @update:model-value="form.fixedMaterialId = $event || null"
          @update:selected-data="selectedMaterial = $event"
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import TreeUtils from '@/utils/tree'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtMaterialSelect, {
    type MaterialSelectRecord
  } from '@/components/business/art-material-select/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import {
    fetchStorageMaterial,
    fetchStorageMaterialsPage,
    saveStorageBin,
    type StorageBin,
    type StorageBinInput,
    type StorageWarehouse,
    type StorageZone
  } from '@mdm/api'

  export interface BinDialogContext {
    warehouse: StorageWarehouse
    zone: StorageZone | null
    bins: StorageBin[]
    row?: StorageBin
    parentId?: string
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<BinDialogContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const context = shallowRef<BinDialogContext>()
  const treeUtils = new TreeUtils({ parentKey: 'parentId', deepClone: false })
  const excludedParentIds = computed(() => {
    const row = context.value?.row
    if (!row) return new Set<string>()
    const tree = treeUtils.listToTree(context.value?.bins ?? [])
    return new Set(treeUtils.getDescendants(tree, row.id, true).map((bin) => bin.id))
  })
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  void userStore.ensureDictLoaded('mdmWarehouseBinType')
  void userStore.ensureDictLoaded('mdmWarehouseBinStatus')
  const selectedMaterial = ref<MaterialSelectRecord[]>([])
  const form = reactive<StorageBinInput>({
    warehouseId: '',
    zoneId: null,
    parentId: null,
    binCode: '',
    binName: '',
    binType: 'floor',
    shelfCode: null,
    levelNo: null,
    columnNo: null,
    maxWeightKg: null,
    maxAreaSqm: null,
    maxQuantity: null,
    fixedMaterialId: null,
    allowMix: true,
    supportsSerial: false,
    status: 'available',
    sort: 10,
    remark: null
  })
  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '库位身份', type: 'divider', span: 24 },
    {
      key: 'binCode',
      label: '库位编码',
      type: 'input',
      props: { maxlength: 60, placeholder: '如 WH01-A-S01-1-1' }
    },
    {
      key: 'binName',
      label: '库位名称',
      type: 'input',
      props: { maxlength: 100, placeholder: '如 一层一列' }
    },
    {
      key: 'binType',
      label: '库位类型',
      type: 'select',
      options: getDictMap.value.mdmWarehouseBinType ?? []
    },
    {
      key: 'parentId',
      label: '上级存储单元',
      type: 'select',
      options:
        context.value?.bins
          .filter(
            (bin) =>
              !excludedParentIds.value.has(bin.id) &&
              bin.zoneId === (context.value?.zone?.id ?? null)
          )
          .map((bin) => ({ label: `${bin.binCode} · ${bin.binName}`, value: bin.id })) ?? [],
      props: { clearable: true, filterable: true, placeholder: '顶层库位' }
    },
    { key: 'capacity', label: '货架与容量', type: 'divider', span: 24 },
    {
      key: 'shelfCode',
      label: '货架号',
      type: 'input',
      props: { maxlength: 40, placeholder: '可选，如 S01' }
    },
    {
      key: 'levelNo',
      label: '层号',
      type: 'number',
      props: { min: 1, precision: 0, class: 'w-full!' }
    },
    {
      key: 'columnNo',
      label: '列号',
      type: 'number',
      props: { min: 1, precision: 0, class: 'w-full!' }
    },
    {
      key: 'maxQuantity',
      label: '最大数量',
      type: 'number',
      props: { min: 0.001, precision: 3, class: 'w-full!' }
    },
    {
      key: 'maxWeightKg',
      label: '最大承重（kg）',
      type: 'number',
      props: { min: 0.001, precision: 3, class: 'w-full!' }
    },
    {
      key: 'maxAreaSqm',
      label: '最大面积（㎡）',
      type: 'number',
      props: { min: 0.001, precision: 3, class: 'w-full!' }
    },
    {
      key: 'fixedMaterialId',
      label: '定容指定物料',
      type: 'slot',
      span: 24,
      help: '指定物料并设置至少一项容量上限后，展板将显示定容边框。'
    },
    { key: 'policy', label: '存放控制', type: 'divider', span: 24 },
    { key: 'allowMix', label: '允许混放物料', type: 'switch' },
    { key: 'supportsSerial', label: '支持 SN 序列号', type: 'switch' },
    {
      key: 'status',
      label: '库位状态',
      type: 'select',
      options: getDictMap.value.mdmWarehouseBinStatus ?? []
    },
    {
      key: 'sort',
      label: '显示顺序',
      type: 'number',
      props: { min: 0, precision: 0, class: 'w-full!' }
    },
    {
      key: 'remark',
      label: '备注',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500, showWordLimit: true }
    }
  ])
  const rules = {
    binCode: [
      { required: true, message: '请输入库位编码', trigger: 'blur' },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: '编码格式不正确', trigger: 'blur' }
    ],
    binName: [{ required: true, message: '请输入库位名称', trigger: 'blur' }],
    binType: [{ required: true, message: '请选择库位类型', trigger: 'change' }],
    status: [{ required: true, message: '请选择库位状态', trigger: 'change' }]
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
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!context.value) return false
      if (form.fixedMaterialId && !form.maxQuantity && !form.maxWeightKg && !form.maxAreaSqm) {
        ElMessage.warning('定容库位需要设置至少一项容量上限')
        return false
      }
      await saveStorageBin(
        context.value.warehouse.tenantId,
        {
          ...form,
          binCode: form.binCode.trim().toUpperCase(),
          binName: form.binName.trim(),
          parentId: normalizeNullableText(form.parentId),
          shelfCode: normalizeNullableText(form.shelfCode?.toUpperCase()),
          remark: normalizeNullableText(form.remark)
        },
        context.value.row?.id
      )
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '库位档案保存失败，请检查填写内容和网络后重试')
      return false
    }
  }
  async function handleOpen(data: BinDialogContext): Promise<void> {
    context.value = data
    const row = data.row
    Object.assign(form, {
      warehouseId: data.warehouse.id,
      zoneId: data.zone?.id ?? null,
      parentId: row?.parentId ?? data.parentId ?? null,
      binCode: row?.binCode ?? '',
      binName: row?.binName ?? '',
      binType: row?.binType ?? 'floor',
      shelfCode: row?.shelfCode ?? null,
      levelNo: row?.levelNo ?? null,
      columnNo: row?.columnNo ?? null,
      maxWeightKg: row?.maxWeightKg ?? null,
      maxAreaSqm: row?.maxAreaSqm ?? null,
      maxQuantity: row?.maxQuantity ?? null,
      fixedMaterialId: row?.fixedMaterialId ?? null,
      allowMix: row?.allowMix ?? true,
      supportsSerial: row?.supportsSerial ?? false,
      status: row?.status ?? 'available',
      sort: row?.sort ?? 10,
      remark: row?.remark ?? null
    })
    selectedMaterial.value = []
    await dialogRef.value?.handleOpen(data, {
      title: row ? '编辑库位' : data.parentId ? '新增子单元' : '新增库位',
      subtitle: `${data.warehouse.warehouseName} · ${data.zone?.zoneName ?? '仓库直挂'}`,
      loading: Boolean(row?.fixedMaterialId),
      loadingText: '正在加载定容物料…',
      onConfirm: submit,
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        if (!row?.fixedMaterialId) return
        try {
          const material = await fetchStorageMaterial(row.fixedMaterialId)
          if (material) selectedMaterial.value = [material]
        } catch {
          ElMessage.warning('定容物料加载失败，请关闭弹窗后重试')
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
