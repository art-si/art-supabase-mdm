<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="governance-change-dialog">
      <div class="governance-change-dialog__notice">
        <ArtSvgIcon icon="ri:git-pull-request-line" />
        <div>
          <strong>来源主档不会被前端直接改写</strong>
          <span>申请需由另一账号审核；到达生效时间后发布为可重试的 Outbox 指令。</span>
        </div>
      </div>
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="formItems"
        :rules="formRules"
        :span="12"
        :show-reset="false"
        :show-submit="false"
        label-position="top"
        scroll-to-error
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import {
    createMdmChangeRequest,
    mdmCatalogSourceDefinitions,
    type MdmGovernanceDomain
  } from '@mdm/api'

  defineOptions({ name: 'MdmChangeRequestDialog' })

  interface FormExpose {
    validate: () => Promise<boolean>
  }

  interface ChangeForm {
    domainKey: MdmGovernanceDomain
    sourceType: string
    sourceRecordId: string
    operation: 'create' | 'update' | 'enable' | 'disable' | 'retire' | 'merge'
    title: string
    reason: string
    beforeDataText: string
    proposedDataText: string
    effectiveAt: string
  }

  const emit = defineEmits<{ (event: 'success'): void }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<FormExpose>()
  const form = reactive<ChangeForm>({
    domainKey: 'organization',
    sourceType: '',
    sourceRecordId: '',
    operation: 'update',
    title: '',
    reason: '',
    beforeDataText: '{}',
    proposedDataText: '{\n  \n}',
    effectiveAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  })

  const domainOptions = useDictionaryOptions('mdmGovernanceDomain')
  const operationOptions = useDictionaryOptions('mdmGovernanceOperation')
  const sourceOptions = computed(() => {
    const scopeByDomain: Record<MdmGovernanceDomain, (keyof typeof mdmCatalogSourceDefinitions)[]> =
      {
        organization: ['organization', 'position', 'employee'],
        partner: ['partner'],
        logistics: ['logistics'],
        asset: ['vehicle', 'equipment'],
        material: ['material']
      }
    const domainSources = scopeByDomain[form.domainKey]
      .flatMap((scope) => mdmCatalogSourceDefinitions[scope])
      .filter((source) => source.kind === 'master')
    return domainSources.map((source) => ({ label: source.label, value: source.type }))
  })

  const formItems = computed<FormItem[]>(() => [
    { label: '变更范围', key: 'scopeDivider', type: 'divider', span: 24 },
    {
      label: '治理域',
      key: 'domainKey',
      type: 'select',
      options: domainOptions,
      props: {
        onChange: () => {
          form.sourceType = ''
        }
      }
    },
    {
      label: '主档类型',
      key: 'sourceType',
      type: 'select',
      options: sourceOptions.value,
      props: { filterable: true, placeholder: '请选择来源主档' }
    },
    { label: '变更动作', key: 'operation', type: 'select', options: operationOptions },
    {
      label: '来源记录 ID',
      key: 'sourceRecordId',
      type: 'input',
      description: form.operation === 'create' ? '新增主档可留空' : '非新增动作必须填写 UUID',
      props: { clearable: true, placeholder: '来源记录 UUID' }
    },
    { label: '申请内容', key: 'contentDivider', type: 'divider', span: 24 },
    {
      label: '变更标题',
      key: 'title',
      type: 'input',
      span: 24,
      props: { maxlength: 120, showWordLimit: true }
    },
    { label: '业务原因', key: 'reason', type: 'textarea', span: 24 },
    {
      label: '当前数据快照（JSON）',
      key: 'beforeDataText',
      type: 'textarea',
      span: 12,
      props: { maxlength: 20000, autosize: { minRows: 6, maxRows: 14 } }
    },
    {
      label: '拟变更数据（JSON）',
      key: 'proposedDataText',
      type: 'textarea',
      span: 12,
      props: { maxlength: 20000, autosize: { minRows: 6, maxRows: 14 } }
    },
    {
      label: '计划生效时间',
      key: 'effectiveAt',
      type: 'date',
      span: 12,
      props: {
        type: 'datetime',
        valueFormat: 'YYYY-MM-DDTHH:mm:ssZ',
        placeholder: '选择生效时间'
      }
    }
  ])

  const jsonObjectRule = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
    try {
      const parsed = JSON.parse(value)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        callback(new Error('请输入 JSON 对象'))
        return
      }
      callback()
    } catch {
      callback(new Error('JSON 格式无效'))
    }
  }
  const formRules = computed<FormRules>(() => ({
    domainKey: [{ required: true, message: '请选择治理域', trigger: 'change' }],
    sourceType: [{ required: true, message: '请选择主档类型', trigger: 'change' }],
    sourceRecordId:
      form.operation === 'create'
        ? []
        : [
            { required: true, message: '请输入来源记录 ID', trigger: 'blur' },
            {
              pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
              message: '请输入有效 UUID',
              trigger: 'blur'
            }
          ],
    title: [{ required: true, message: '请输入变更标题', trigger: 'blur' }],
    reason: [{ required: true, message: '请输入业务原因', trigger: 'blur' }],
    beforeDataText: [{ validator: jsonObjectRule, trigger: 'blur' }],
    proposedDataText: [
      { required: true, message: '请输入拟变更数据', trigger: 'blur' },
      { validator: jsonObjectRule, trigger: 'blur' }
    ],
    effectiveAt: [{ required: true, message: '请选择生效时间', trigger: 'change' }]
  }))

  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '变更申请校验未完成，请稍后重试', 'warning')
      return false
    }
    try {
      const proposedData = JSON.parse(form.proposedDataText) as Record<string, unknown>
      if (!Object.keys(proposedData).length) {
        ElMessage.warning('拟变更数据不能为空，请填写字段后重试')
        return false
      }
      await createMdmChangeRequest({
        domainKey: form.domainKey,
        sourceType: form.sourceType,
        sourceRecordId: normalizeNullableText(form.sourceRecordId),
        operation: form.operation,
        title: form.title.trim(),
        reason: form.reason.trim(),
        beforeData: JSON.parse(form.beforeDataText) as Record<string, unknown>,
        proposedData,
        effectiveAt: form.effectiveAt
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '变更申请创建失败，请检查拟变更数据和权限后重试')
      return false
    }
  }

  async function handleOpen(): Promise<void> {
    Object.assign(form, {
      domainKey: 'organization',
      sourceType: '',
      sourceRecordId: '',
      operation: 'update',
      title: '',
      reason: '',
      beforeDataText: '{}',
      proposedDataText: '{\n  \n}',
      effectiveAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    })
    await dialogRef.value?.handleOpen(undefined, {
      title: '发起主数据变更',
      confirmText: '创建草稿',
      onConfirm: submit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .governance-change-dialog {
    display: grid;
    gap: 18px;

    &__notice {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 12px;
      padding: 13px 14px;
      color: var(--el-text-color-regular);
      background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
      border: 1px solid var(--el-color-primary-light-7);
      border-radius: var(--el-border-radius-base);

      > .art-svg-icon {
        margin-top: 2px;
        font-size: 19px;
        color: var(--el-color-primary);
      }

      div {
        display: grid;
        gap: 3px;
      }

      strong {
        font-size: 13px;
      }

      span {
        font-size: 12px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
