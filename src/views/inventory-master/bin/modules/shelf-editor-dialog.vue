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
    <div class="mt-3 space-y-1 text-xs text-[var(--el-text-color-secondary)]">
      <p
        >当前 {{ existingBins.length }} 个库位；保存后为
        {{ form.levels * form.columns }} 个层列单元。</p
      >
      <p v-if="removedCount" class="text-[var(--el-color-warning)]">
        将移除
        {{ removedCount }} 个超出新层列范围的库位。存在库存、子单元或业务引用时，保存会被拒绝。
      </p>
      <p v-if="!form.applyMaxQuantity">
        现有格位容量保持原值，新增格位默认不限；勾选后可统一设置或清空。
      </p>
      <p v-if="form.applyMaxQuantity">新数值会覆盖全部现有单元；留空表示清空容量上限。</p>
      <p v-if="hasManagedCodes">新增格位沿用原货架的分隔符，货架编码保持不变。</p>
      <p v-else
        >历史编码货架可调整容量或缩减层列；新增格位请使用“生成货架”建立新货架，避免混用编码。</p
      >
    </div>
  </ArtDialog>
  <MasterDataDeleteGuard ref="deleteGuardRef" />
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { getDeleteReferenceContext } from '@/utils/supabase/delete-reference'
  import { ElMessage } from 'element-plus'
  import { useAuth } from '@/hooks/core/useAuth'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import {
    updateStorageShelf,
    type StorageBin,
    type StorageWarehouse,
    type StorageZone
  } from '@mdm/api'

  export interface ShelfEditorContext {
    warehouse: StorageWarehouse
    zone: StorageZone | null
    code: string
    bins: StorageBin[]
  }

  const emit = defineEmits<{ success: [code: string] }>()
  const { hasAuth } = useAuth()
  const { confirmDelete } = useArtFeedback()
  const { deleteGuardRef, inspectDeleteReferences } = useRecordDeleteGuard(
    'mdm_warehouse_bin',
    '库位'
  )
  const dialogRef = ref<ArtDialogExpose<ShelfEditorContext>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const context = shallowRef<ShelfEditorContext>()
  const existingBins = shallowRef<StorageBin[]>([])
  const originalLevels = ref(1)
  const originalColumns = ref(1)
  const form = ref({
    shelfCode: '',
    levels: 1,
    columns: 1,
    applyMaxQuantity: false,
    maxQuantity: null as number | null
  })
  const canAdd = computed(() => hasAuth('MdmWarehouseBin:Add'))
  const canDelete = computed(() => hasAuth('MdmWarehouseBin:Delete'))
  const hasManagedCodes = computed(
    () =>
      existingBins.value.length > 0 && existingBins.value.every((bin) => bin.codeSeparator != null)
  )
  const removedCount = computed(
    () =>
      existingBins.value.filter(
        (bin) => (bin.levelNo ?? 0) > form.value.levels || (bin.columnNo ?? 0) > form.value.columns
      ).length
  )
  const items = computed<FormItem[]>(() => [
    {
      key: 'shelfCode',
      label: '货架编码',
      type: 'input',
      span: 24,
      props: { maxlength: 40, placeholder: '如 A1', disabled: hasManagedCodes.value }
    },
    {
      key: 'levels',
      label: '层数',
      type: 'number',
      props: {
        min: canDelete.value ? 1 : originalLevels.value,
        max: canAdd.value && hasManagedCodes.value ? 20 : originalLevels.value,
        precision: 0,
        class: 'w-full!'
      }
    },
    {
      key: 'columns',
      label: '列数',
      type: 'number',
      props: {
        min: canDelete.value ? 1 : originalColumns.value,
        max: canAdd.value && hasManagedCodes.value ? 30 : originalColumns.value,
        precision: 0,
        class: 'w-full!'
      }
    },
    { key: 'applyMaxQuantity', label: '统一修改每格最大数量', type: 'switch', span: 24 },
    ...(form.value.applyMaxQuantity
      ? [
          {
            key: 'maxQuantity',
            label: '每格最大数量',
            type: 'number' as const,
            span: 24,
            props: { min: 0.001, precision: 3, class: 'w-full!' }
          }
        ]
      : [])
  ])
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
      if (form.value.levels > originalLevels.value || form.value.columns > originalColumns.value) {
        if (!canAdd.value || !hasManagedCodes.value) {
          ElMessage.warning('当前货架无法扩层扩列，请核对新增权限及原编码格式')
          return false
        }
      }
      if (removedCount.value && !canDelete.value) {
        ElMessage.warning('当前账号无删除库位权限，无法缩小货架层列')
        return false
      }
      const shelfCode = form.value.shelfCode.trim().toUpperCase()
      const removed = existingBins.value
        .filter(
          (bin) =>
            (bin.levelNo ?? 0) > form.value.levels || (bin.columnNo ?? 0) > form.value.columns
        )
        .map((bin) => ({ id: bin.id, label: `${bin.binName} · ${bin.binCode}` }))
      if (removed.length) {
        if (await inspectDeleteReferences(removed)) return false
        await confirmDelete(
          `保存将删除 ${removed.length} 个超出层列范围的库位，此操作不可恢复。确认继续？`
        )
        if (!canDelete.value) throw new Error('删除权限已变化，请刷新后重试')
      }
      try {
        await updateStorageShelf({
          warehouseId: context.value.warehouse.id,
          zoneId: context.value.zone?.id ?? null,
          currentShelfCode: context.value.code,
          shelfCode,
          levels: form.value.levels,
          columns: form.value.columns,
          applyMaxQuantity: form.value.applyMaxQuantity,
          maxQuantity: form.value.maxQuantity,
          expectedBinIds: existingBins.value.map((bin) => bin.id)
        })
      } catch (error) {
        if (
          removed.length &&
          (await inspectDeleteReferences(removed, getDeleteReferenceContext(error)?.constraint))
        )
          return false
        throw error
      }
      emit('success', shelfCode)
      return true
    } catch (error) {
      if (error === 'cancel' || error === 'close') return false
      notifyFriendlyError(error, '货架配置保存失败，请检查填写内容和网络后重试')
      return false
    }
  }

  async function handleOpen(data: ShelfEditorContext): Promise<void> {
    const shelfBins = data.bins.filter(
      (bin) =>
        bin.warehouseId === data.warehouse.id &&
        bin.zoneId === (data.zone?.id ?? null) &&
        bin.binType === 'shelf' &&
        bin.parentId === null &&
        bin.shelfCode === data.code
    )
    if (!shelfBins.length) {
      ElMessage.warning('货架数据已变化，请刷新后重试')
      return
    }
    context.value = data
    existingBins.value = shelfBins
    originalLevels.value = Math.max(1, ...shelfBins.map((bin) => bin.levelNo ?? 0))
    originalColumns.value = Math.max(1, ...shelfBins.map((bin) => bin.columnNo ?? 0))
    const firstQuantity = shelfBins[0].maxQuantity
    Object.assign(form.value, {
      shelfCode: data.code,
      levels: originalLevels.value,
      columns: originalColumns.value,
      applyMaxQuantity: false,
      maxQuantity: shelfBins.every((bin) => bin.maxQuantity === firstQuantity)
        ? firstQuantity
        : null
    })
    await dialogRef.value?.handleOpen(data, {
      title: `编辑货架 · ${data.code}`,
      subtitle: `${data.warehouse.warehouseName} · ${data.zone?.zoneName ?? '仓库直挂'}`,
      confirmText: '保存货架',
      onConfirm: submit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }

  defineExpose({ handleOpen })
</script>
