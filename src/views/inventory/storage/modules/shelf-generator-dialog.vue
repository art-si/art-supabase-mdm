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
    <div
      class="mt-3 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-4"
      aria-live="polite"
    >
      <p class="text-sm font-medium text-[var(--el-text-color-primary)]">编码示例</p>
      <p class="mt-2 break-all font-mono text-sm text-[var(--el-color-primary)]">{{
        previewCodes
      }}</p>
      <p class="mt-2 text-xs leading-5 text-[var(--el-text-color-secondary)]">
        货架编码 + 层号 + 列号，层号与列号固定为两位。共 {{ form.levels * form.columns }}
        个格位；重复生成仅补充缺失格位，已有库位与容量保持不变。
      </p>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { createShelfBins, type StorageWarehouse, type StorageZone } from '@mdm/api'
  import { ElMessage } from 'element-plus'
  import { formatWarehouseBinCode } from '../../../../domain/warehouse-bin-code'

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
    separator: '-',
    maxQuantity: null as number | null
  })
  const items: FormItem[] = [
    {
      key: 'shelfCode',
      label: '货架编码',
      type: 'input',
      props: { maxlength: 40, placeholder: '如 A1' }
    },
    {
      key: 'separator',
      label: '段间分隔符',
      type: 'input',
      props: { maxlength: 1, placeholder: '留空表示不分隔' },
      help: '支持连字符 -、下划线 _，留空不分隔。'
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
    separator: [{ pattern: /^[-_]?$/, message: '请输入 -、_ 或留空', trigger: 'blur' }],
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
  const previewCodes = computed(() => {
    const shelfCode = form.value.shelfCode || 'A1'
    const positions = [[1, 1]]
    if (form.value.columns > 1) positions.push([1, 2])
    if (form.value.levels > 1) positions.push([2, 1])
    return positions
      .map(([level, column]) =>
        formatWarehouseBinCode(shelfCode, level, column, form.value.separator)
      )
      .join('、')
  })
  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (!context.value) return false
      const { warehouse, zone } = context.value
      const shelfCode = form.value.shelfCode.trim().toUpperCase()
      const count = await createShelfBins({
        warehouseId: warehouse.id,
        zoneId: zone?.id ?? null,
        shelfCode,
        levels: form.value.levels,
        columns: form.value.columns,
        maxQuantity: form.value.maxQuantity,
        separator: form.value.separator
      })
      ElMessage.success(count ? `已生成 ${count} 个库位` : '该货架格位已齐全，无需重复生成')
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '货架生成保存失败，请检查填写内容和网络后重试')
      return false
    }
  }
  async function handleOpen(data: ShelfGeneratorContext): Promise<void> {
    context.value = data
    Object.assign(form.value, {
      shelfCode: '',
      levels: 4,
      columns: 3,
      separator: '-',
      maxQuantity: null
    })
    await dialogRef.value?.handleOpen(data, {
      title: '批量生成货架库位',
      subtitle: `${data.warehouse.warehouseName} · ${data.zone?.zoneName ?? '仓库直挂'}`,
      confirmText: '生成库位',
      onConfirm: submit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }
  defineExpose({ handleOpen })
</script>
