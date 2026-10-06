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
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchMaterialCategories,
    saveStorageZone,
    type MaterialCategory,
    type StorageWarehouse,
    type StorageZone,
    type StorageZoneInput
  } from '@mdm/api'

  export interface ZoneDialogContext {
    warehouse: StorageWarehouse
    row?: StorageZone
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ZoneDialogContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const { getDictMap } = storeToRefs(useUserStore())
  const userStore = useUserStore()
  void userStore.ensureDictLoaded('mdmWarehouseZonePurpose')
  void userStore.ensureDictLoaded('commonEnabledStatus')
  const context = shallowRef<ZoneDialogContext>()
  const categories = ref<MaterialCategory[]>([])
  const form = reactive<StorageZoneInput>({
    warehouseId: '',
    zoneCode: '',
    zoneName: '',
    categoryId: null,
    purpose: null,
    allowMix: true,
    requiresInspection: false,
    allowLock: true,
    abnormal: false,
    status: 'enabled',
    sort: 10,
    remark: null
  })
  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '库区身份', type: 'divider', span: 24 },
    {
      key: 'zoneCode',
      label: '库区编码',
      type: 'input',
      props: { maxlength: 40, placeholder: '如 RAW_A' }
    },
    {
      key: 'zoneName',
      label: '库区名称',
      type: 'input',
      props: { maxlength: 100, placeholder: '如 板材区' }
    },
    {
      key: 'categoryId',
      label: '存放物料分类',
      type: 'select',
      options: categories.value
        .filter((category) => category.status === 'enabled')
        .map((category) => ({
          label: `${category.categoryName} · ${category.categoryCode}`,
          value: category.id
        })),
      props: { clearable: true, filterable: true, placeholder: '不限物料分类' }
    },
    {
      key: 'purpose',
      label: '库区用途',
      type: 'select',
      options: getDictMap.value.mdmWarehouseZonePurpose ?? [],
      props: { clearable: true, placeholder: '选择用途' }
    },
    { key: 'policy', label: '存放控制', type: 'divider', span: 24 },
    { key: 'allowMix', label: '允许混放物料', type: 'switch' },
    { key: 'requiresInspection', label: '需要质检', type: 'switch' },
    { key: 'allowLock', label: '允许锁库', type: 'switch' },
    { key: 'abnormal', label: '异常标记', type: 'switch' },
    {
      key: 'status',
      label: '启用状态',
      type: 'select',
      options: getDictMap.value.commonEnabledStatus ?? []
    },
    {
      key: 'sort',
      label: '显示顺序',
      type: 'number',
      props: { min: 0, precision: 0, class: 'w-full!' },
      help: '也可在库区展板中拖动排序。'
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
    zoneCode: [
      { required: true, message: '请输入库区编码', trigger: 'blur' },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: '编码格式不正确', trigger: 'blur' }
    ],
    zoneName: [{ required: true, message: '请输入库区名称', trigger: 'blur' }]
  }
  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!context.value) return false
      await saveStorageZone(
        context.value.warehouse.tenantId,
        {
          ...form,
          zoneCode: form.zoneCode.trim().toUpperCase(),
          zoneName: form.zoneName.trim(),
          categoryId: normalizeNullableText(form.categoryId),
          purpose: normalizeNullableText(form.purpose),
          remark: normalizeNullableText(form.remark)
        },
        context.value.row?.id
      )
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '仓储区域保存失败，请检查填写内容和网络后重试')
      return false
    }
  }
  async function handleOpen(data: ZoneDialogContext): Promise<void> {
    context.value = data
    Object.assign(form, {
      warehouseId: data.warehouse.id,
      zoneCode: data.row?.zoneCode ?? '',
      zoneName: data.row?.zoneName ?? '',
      categoryId: data.row?.categoryId ?? null,
      purpose: data.row?.purpose ?? null,
      allowMix: data.row?.allowMix ?? true,
      requiresInspection: data.row?.requiresInspection ?? false,
      allowLock: data.row?.allowLock ?? true,
      abnormal: data.row?.abnormal ?? false,
      status: data.row?.status ?? 'enabled',
      sort: data.row?.sort ?? 10,
      remark: data.row?.remark ?? null
    })
    categories.value = []
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑库区' : '新增库区',
      subtitle: `${data.warehouse.warehouseName} · 库区主数据`,
      loading: true,
      loadingText: '正在加载物料分类…',
      onConfirm: submit,
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          categories.value = await fetchMaterialCategories(data.warehouse.tenantId)
        } catch {
          ElMessage.warning('物料分类加载失败，请关闭弹窗后重试')
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
