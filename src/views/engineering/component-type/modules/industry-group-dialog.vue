<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="grid gap-4">
      <ArtEntitySummary
        icon="ri:folder-3-line"
        eyebrow="INDUSTRY GROUP"
        :title="model.name || '新增行业分组'"
        :description="model.code || '按行业建立组件类型层级'"
        compact
      />
      <ArtForm
        ref="formRef"
        v-model="model"
        :items="items"
        :rules="rules"
        :span="12"
        label-position="top"
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import TreeUtils from '@/utils/tree'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { cloneDeep } from 'lodash-es'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import {
    saveComponentIndustryGroup,
    type ComponentIndustryGroup,
    type ComponentIndustryGroupInput
  } from '@mdm/api'

  export interface IndustryGroupDialogOpenData {
    row?: ComponentIndustryGroup
    parent?: ComponentIndustryGroup
    groups: ComponentIndustryGroup[]
    tenantId: string
    tenantOptions: Array<{ label: string; value: string }>
  }

  const optionTree = new TreeUtils({ idKey: 'value', parentKey: 'parentId' })
  const emit = defineEmits<{ success: [id: string] }>()
  const dialogRef = ref<ArtDialogExpose<IndustryGroupDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const createModel = (): ComponentIndustryGroupInput => ({
    id: undefined,
    tenantId: '',
    parentId: null,
    code: '',
    name: '',
    sort: 10,
    enabled: true,
    remark: ''
  })
  const model = ref(createModel())
  const context = reactive({
    groups: [] as ComponentIndustryGroup[],
    tenantOptions: [] as IndustryGroupDialogOpenData['tenantOptions']
  })
  const items = computed<FormItem[]>(() => [
    {
      key: 'tenantId',
      label: '所属租户',
      type: 'select',
      span: 24,
      hidden: context.tenantOptions.length <= 1 && Boolean(model.value.tenantId),
      options: context.tenantOptions,
      props: { disabled: Boolean(model.value.id || model.value.parentId), filterable: true }
    },
    {
      key: 'parentId',
      label: '上级分组',
      type: 'treeSelect',
      span: 24,
      options: optionTree.removeNodesByCondition(
        optionTree.listToTree(
          context.groups
            .filter((group) => group.tenantId === model.value.tenantId)
            .map((group) => ({
              label: `${group.name}（${group.code}）`,
              value: group.id,
              parentId: group.parentId
            }))
        ),
        (node) => node.value === model.value.id
      ).tree,
      props: { checkStrictly: true, clearable: true, placeholder: '不选择则为顶级行业' }
    },
    {
      key: 'code',
      label: '分组编码',
      type: 'input',
      props: { maxlength: 40, placeholder: '如 PANEL' }
    },
    {
      key: 'name',
      label: '分组名称',
      type: 'input',
      props: { maxlength: 80, placeholder: '如 板材加工行业' }
    },
    {
      key: 'sort',
      label: '排序',
      type: 'number',
      props: { min: 0, max: 999999, precision: 0, class: 'w-full!' }
    },
    {
      key: 'enabled',
      label: '状态',
      type: 'switch',
      props: { activeText: '启用', inactiveText: '禁用' }
    },
    {
      key: 'remark',
      label: '备注',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])
  const rules = {
    tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
    code: [
      { required: true, message: '请输入分组编码', trigger: 'blur' },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]{0,39}$/, message: '编码格式不正确', trigger: 'blur' }
    ],
    name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }]
  }
  const submit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const id = await saveComponentIndustryGroup({
        ...model.value,
        code: model.value.code.trim().toUpperCase(),
        name: model.value.name.trim(),
        remark: normalizeNullableText(model.value.remark)
      })
      emit('success', id)
      return true
    } catch (error) {
      notifyFriendlyError(error, '行业分组保存失败，请检查填写内容和网络后重试')
      return false
    }
  }
  const handleOpen = async (data: IndustryGroupDialogOpenData): Promise<void> => {
    Object.assign(
      model.value,
      createModel(),
      data.row
        ? cloneDeep(data.row)
        : {
            tenantId: data.parent?.tenantId || data.tenantId,
            parentId: data.parent?.id || null
          }
    )
    context.groups = data.groups
    context.tenantOptions = data.tenantOptions
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑行业分组' : '新增行业分组',
      contentMaxHeight: '70vh',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: submit
    })
  }
  watch(
    () => model.value.tenantId,
    (tenantId) => {
      if (
        model.value.parentId &&
        !context.groups.some(
          (group) => group.id === model.value.parentId && group.tenantId === tenantId
        )
      )
        model.value.parentId = null
    }
  )
  defineExpose({ handleOpen })
</script>
