<template>
  <ArtDialog ref="dialogRef" size="md">
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
    />
    <p class="mt-3 text-xs text-[var(--el-text-color-secondary)]">
      将一次生成 {{ form.levels * form.columns }} 个货架单元，库位编码按“系统管理 →
      编号规则”中的“库位编码”规则自动生成。
    </p>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { createShelfBins, type StorageWarehouse, type StorageZone } from '@mdm/api'

  export interface ShelfGeneratorContext {
    warehouse: StorageWarehouse
    zone: StorageZone | null
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ShelfGeneratorContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const context = shallowRef<ShelfGeneratorContext>()
  const form = ref({
    shelfCode: '',
    levels: 4,
    columns: 3,
    maxQuantity: null as number | null
  })
  const items: FormItem[] = [
    {
      key: 'shelfCode',
      label: '货架编码',
      type: 'input',
      span: 24,
      props: { maxlength: 40, placeholder: '如 S01' }
    },
    {
      key: 'levels',
      label: '层数',
      type: 'number',
      props: { min: 1, max: 20, precision: 0, class: 'w-full!' }
    },
    {
      key: 'columns',
      label: '列数',
      type: 'number',
      props: { min: 1, max: 30, precision: 0, class: 'w-full!' }
    },
    {
      key: 'maxQuantity',
      label: '每格最大数量',
      type: 'number',
      span: 24,
      props: { min: 0.001, precision: 3, class: 'w-full!' },
      help: '可稍后逐格编辑面积、承重或定容物料。'
    }
  ]
  const rules = {
    shelfCode: [
      { required: true, message: '请输入货架编码', trigger: 'blur' },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: '编码格式不正确', trigger: 'blur' }
    ],
    levels: [
      {
        required: true,
        type: 'number' as const,
        min: 1,
        max: 20,
        message: '层数应为 1–20',
        trigger: 'change'
      }
    ],
    columns: [
      {
        required: true,
        type: 'number' as const,
        min: 1,
        max: 30,
        message: '列数应为 1–30',
        trigger: 'change'
      }
    ]
  }
  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!context.value) return false
      const { warehouse, zone } = context.value
      const shelfCode = form.value.shelfCode.trim().toUpperCase()
      await createShelfBins({
        warehouseId: warehouse.id,
        zoneId: zone?.id ?? null,
        shelfCode,
        levels: form.value.levels,
        columns: form.value.columns,
        maxQuantity: form.value.maxQuantity
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '货架生成保存失败，请检查填写内容和网络后重试')
      return false
    }
  }
  async function handleOpen(data: ShelfGeneratorContext): Promise<void> {
    context.value = data
    Object.assign(form.value, { shelfCode: '', levels: 4, columns: 3, maxQuantity: null })
    await dialogRef.value?.handleOpen(data, {
      title: '批量生成货架库位',
      subtitle: `${data.warehouse.warehouseName} · ${data.zone?.zoneName ?? '仓库直挂'}`,
      onConfirm: submit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }
  defineExpose({ handleOpen })
</script>
