<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="warehouse-group-dialog">
      <ArtEntitySummary
        icon="ri:folder-add-line"
        eyebrow="WAREHOUSE GROUP"
        :title="form.model.name || '新仓库分组'"
        :description="
          form.model.code ? `分组编码：${form.model.code}` : '建立清晰、可扩展的仓库层级。'
        "
      />
      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="formItems"
        :rules="formRules"
        :span="12"
        :gutter="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { cloneDeep } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { saveWarehouseGroup, type WarehouseGroup, type WarehouseGroupInput } from '@mdm/api'

  const commonEnabledStatusOptions = useDictionaryOptions(
    'commonEnabledStatus',
    (value) => value === 'enabled'
  )

  export interface WarehouseGroupDialogOpenData {
    row?: WarehouseGroup
    parentId?: string
    groups: WarehouseGroup[]
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<WarehouseGroupDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const initialForm = (): WarehouseGroupInput & { id?: string } => ({
    id: undefined,
    parentId: null,
    code: '',
    name: '',
    sort: 10,
    enabled: true,
    remark: ''
  })
  const form = reactive({
    model: initialForm(),
    groups: [] as WarehouseGroup[]
  })
  const formItems = computed<FormItem[]>(() => [
    {
      label: '分组编码',
      key: 'code',
      type: 'input',
      props: { maxlength: 40, placeholder: '如 FINISHED_GOODS' },
      help: '以字母开头，仅支持字母、数字、下划线和短横线。'
    },
    {
      label: '分组名称',
      key: 'name',
      type: 'input',
      props: { maxlength: 80, placeholder: '如 成品仓组' }
    },
    {
      label: '上级分组',
      key: 'parentId',
      type: 'treeSelect',
      options: form.groups
        .filter((item) => item.id !== form.model.id)
        .map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id })),
      props: { clearable: true, checkStrictly: true, placeholder: '不选择则为顶级分组' }
    },
    {
      label: '启用状态',
      key: 'enabled',
      type: 'segment',
      options: commonEnabledStatusOptions
    },
    {
      label: '显示顺序',
      key: 'sort',
      type: 'number',
      props: { min: 0, max: 999999, precision: 0, class: '!w-full' }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true, resize: 'none' }
    }
  ])
  const formRules = {
    code: [
      { required: true, message: '请输入分组编码', trigger: 'blur' },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: '编码格式不正确', trigger: 'blur' }
    ],
    name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }]
  }

  const submit = async (): Promise<boolean> => {
    try {
      await formRef.value?.validate()
      await saveWarehouseGroup(
        {
          parentId: form.model.parentId || null,
          code: form.model.code.trim().toUpperCase(),
          name: form.model.name.trim(),
          sort: Number(form.model.sort),
          enabled: form.model.enabled,
          remark: form.model.remark.trim()
        },
        form.model.id
      )
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch {
      return false
    }
  }

  async function handleOpen(data: WarehouseGroupDialogOpenData): Promise<void> {
    Object.assign(form.model, initialForm())
    form.groups = cloneDeep(data.groups)
    if (data.row) Object.assign(form.model, cloneDeep(data.row))
    else form.model.parentId = data.parentId || null
    await dialogRef.value?.handleOpen(data, {
      title: form.model.id ? '编辑仓库分组' : '新增仓库分组',
      subtitle: '统一维护分组编码、名称与层级关系',
      confirmText: form.model.id ? '保存更改' : '创建分组',
      contentMaxHeight: 'min(62vh, calc(100vh - 220px))',
      onConfirm: submit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .warehouse-group-dialog {
    display: grid;
    gap: 18px;
  }
</style>
