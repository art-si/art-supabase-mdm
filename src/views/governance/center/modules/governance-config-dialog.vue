<template>
  <ArtDialog ref="dialogRef" size="md">
    <div class="governance-config-dialog">
      <div class="governance-config-dialog__context">
        <ArtSvgIcon :icon="contextIcon" />
        <div
          ><strong>{{ contextTitle }}</strong
          ><span>{{ contextDescription }}</span></div
        >
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
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    createMdmQualityRuleVersion,
    fetchMdmGovernanceUsers,
    mdmCatalogSourceDefinitions,
    saveMdmDataSteward,
    saveMdmOutboxConsumer,
    type MdmGovernanceDomain,
    type MdmGovernanceUserOption,
    type MdmSeverity
  } from '@mdm/api'

  defineOptions({ name: 'MdmGovernanceConfigDialog' })

  type ConfigKind = 'steward' | 'rule' | 'consumer'
  interface FormExpose {
    validate: () => Promise<boolean>
  }
  interface ConfigForm {
    domainKey: MdmGovernanceDomain
    sourceType: string
    stewardUserId: string
    escalationUserId: string
    slaHours: number
    enabled: boolean
    ruleCode: string
    ruleName: string
    severity: MdmSeverity
    threshold: number
    effectiveFrom: string
    consumerKey: string
    consumerName: string
    eventTypes: string[]
    contractVersion: number
    visibilityTimeoutSeconds: number
    maxAttempts: number
    replaySince: string
  }

  const emit = defineEmits<{ (event: 'success', kind: ConfigKind): void }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<FormExpose>()
  const kind = ref<ConfigKind>('steward')
  const users = ref<MdmGovernanceUserOption[]>([])
  const form = reactive<ConfigForm>({
    domainKey: 'organization',
    sourceType: '',
    stewardUserId: '',
    escalationUserId: '',
    slaHours: 48,
    enabled: true,
    ruleCode: '',
    ruleName: '',
    severity: 'high',
    threshold: 90,
    effectiveFrom: new Date().toISOString(),
    consumerKey: '',
    consumerName: '',
    eventTypes: ['*'],
    contractVersion: 1,
    visibilityTimeoutSeconds: 60,
    maxAttempts: 10,
    replaySince: ''
  })

  const contextTitle = computed(
    () =>
      ({
        steward: '责任归属与 SLA',
        rule: '不可变质量规则版本',
        consumer: '下游事件交付契约'
      })[kind.value]
  )
  const contextDescription = computed(
    () =>
      ({
        steward: '更细粒度的主档责任人优先于治理域默认责任人，超时后可按升级责任人处理。',
        rule: '每次保存都会生成新版本，旧版本保留完整审计证据，不做原地覆盖。',
        consumer: '消费者按事件类型获得独立投递状态、可见性锁、指数退避和死信重放能力。'
      })[kind.value]
  )
  const contextIcon = computed(
    () =>
      ({
        steward: 'ri:user-star-line',
        rule: 'ri:verified-badge-line',
        consumer: 'ri:route-line'
      })[kind.value]
  )

  const domainOptions = [
    { label: '组织与人员', value: 'organization' },
    { label: '往来主体', value: 'partner' },
    { label: '物流基础', value: 'logistics' },
    { label: '资产设备', value: 'asset' },
    { label: '物料与场所', value: 'material' }
  ]
  const scopeByDomain: Record<MdmGovernanceDomain, (keyof typeof mdmCatalogSourceDefinitions)[]> = {
    organization: ['organization', 'position', 'employee'],
    partner: ['partner'],
    logistics: ['logistics'],
    asset: ['vehicle', 'equipment'],
    material: ['material']
  }
  const sourceOptions = computed(() =>
    scopeByDomain[form.domainKey]
      .flatMap((scope) => mdmCatalogSourceDefinitions[scope])
      .filter((source) => source.kind === 'master')
      .map((source) => ({ label: source.label, value: source.type }))
  )
  const userOptions = computed(() =>
    users.value.map((user) => ({
      label: `${user.userName || user.userEmail} · ${user.userEmail}`,
      value: user.id
    }))
  )

  const formItems = computed<FormItem[]>(() => {
    if (kind.value === 'steward') {
      return [
        { label: '治理域', key: 'domainKey', type: 'select', options: domainOptions },
        {
          label: '主档类型（选填）',
          key: 'sourceType',
          type: 'select',
          options: sourceOptions.value,
          props: { clearable: true, placeholder: '留空表示治理域默认责任人' }
        },
        {
          label: '数据责任人',
          key: 'stewardUserId',
          type: 'select',
          options: userOptions.value,
          props: { filterable: true }
        },
        {
          label: '升级责任人（选填）',
          key: 'escalationUserId',
          type: 'select',
          options: userOptions.value,
          props: { filterable: true, clearable: true }
        },
        {
          label: '整改 SLA（小时）',
          key: 'slaHours',
          type: 'number',
          props: { min: 1, max: 8760 }
        },
        { label: '启用配置', key: 'enabled', type: 'switch' }
      ]
    }
    if (kind.value === 'rule') {
      return [
        {
          label: '规则编码',
          key: 'ruleCode',
          type: 'input',
          props: { placeholder: '例如 catalog.material.completeness' }
        },
        { label: '规则名称', key: 'ruleName', type: 'input' },
        { label: '治理域', key: 'domainKey', type: 'select', options: domainOptions },
        {
          label: '主档类型',
          key: 'sourceType',
          type: 'select',
          options: sourceOptions.value,
          props: { filterable: true }
        },
        {
          label: '严重级别',
          key: 'severity',
          type: 'select',
          options: [
            { label: '低', value: 'low' },
            { label: '中', value: 'medium' },
            { label: '高', value: 'high' },
            { label: '关键', value: 'critical' }
          ]
        },
        {
          label: '完整度阈值',
          key: 'threshold',
          type: 'number',
          props: { min: 0, max: 100, precision: 2 }
        },
        {
          label: '整改 SLA（小时）',
          key: 'slaHours',
          type: 'number',
          props: { min: 1, max: 8760 }
        },
        {
          label: '版本生效时间',
          key: 'effectiveFrom',
          type: 'date',
          props: { type: 'datetime', valueFormat: 'YYYY-MM-DDTHH:mm:ssZ' }
        }
      ]
    }
    return [
      {
        label: '消费者编码',
        key: 'consumerKey',
        type: 'input',
        props: { placeholder: '例如 erp-master-sync' }
      },
      { label: '消费者名称', key: 'consumerName', type: 'input' },
      {
        label: '订阅事件类型',
        key: 'eventTypes',
        type: 'inputTag',
        span: 24,
        description: '使用 * 订阅全部，或逐项输入 mdm.change-request.published 等事件类型'
      },
      { label: '契约版本', key: 'contractVersion', type: 'number', props: { min: 1, max: 1000 } },
      {
        label: '可见性超时（秒）',
        key: 'visibilityTimeoutSeconds',
        type: 'number',
        props: { min: 10, max: 3600 }
      },
      { label: '最大重试次数', key: 'maxAttempts', type: 'number', props: { min: 1, max: 100 } },
      {
        label: '补发起始时间（选填）',
        key: 'replaySince',
        type: 'date',
        props: { type: 'datetime', clearable: true, valueFormat: 'YYYY-MM-DDTHH:mm:ssZ' }
      },
      { label: '启用消费者', key: 'enabled', type: 'switch' }
    ]
  })

  const formRules = computed<FormRules>(() => {
    if (kind.value === 'steward') {
      return {
        domainKey: [{ required: true, message: '请选择治理域', trigger: 'change' }],
        stewardUserId: [{ required: true, message: '请选择数据责任人', trigger: 'change' }],
        slaHours: [{ required: true, message: '请输入整改 SLA', trigger: 'blur' }]
      }
    }
    if (kind.value === 'rule') {
      return {
        ruleCode: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
        ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
        domainKey: [{ required: true, message: '请选择治理域', trigger: 'change' }],
        sourceType: [{ required: true, message: '请选择主档类型', trigger: 'change' }],
        severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }],
        threshold: [{ required: true, message: '请输入完整度阈值', trigger: 'blur' }],
        effectiveFrom: [{ required: true, message: '请选择生效时间', trigger: 'change' }]
      }
    }
    return {
      consumerKey: [{ required: true, message: '请输入消费者编码', trigger: 'blur' }],
      consumerName: [{ required: true, message: '请输入消费者名称', trigger: 'blur' }],
      eventTypes: [
        { required: true, type: 'array', min: 1, message: '至少订阅一种事件', trigger: 'change' }
      ]
    }
  })

  async function submit(): Promise<boolean> {
    try {
      await formRef.value?.validate()
    } catch {
      return false
    }
    if (kind.value === 'steward') {
      await saveMdmDataSteward({
        domainKey: form.domainKey,
        sourceType: form.sourceType || null,
        stewardUserId: form.stewardUserId,
        escalationUserId: form.escalationUserId || null,
        slaHours: form.slaHours,
        enabled: form.enabled
      })
    } else if (kind.value === 'rule') {
      await createMdmQualityRuleVersion({
        ruleCode: form.ruleCode.trim(),
        ruleName: form.ruleName.trim(),
        domainKey: form.domainKey,
        sourceType: form.sourceType,
        severity: form.severity,
        threshold: form.threshold,
        slaHours: form.slaHours,
        definition: {
          evaluator: 'app_private.mdm_catalog_projection',
          evaluatorVersion: 1,
          metric: 'quality_score',
          operator: 'greater_than_or_equal',
          issueField: 'quality_issues'
        },
        effectiveFrom: form.effectiveFrom
      })
    } else {
      await saveMdmOutboxConsumer({
        consumerKey: form.consumerKey.trim(),
        consumerName: form.consumerName.trim(),
        eventTypes: form.eventTypes.map((value) => value.trim()).filter(Boolean),
        contractVersion: form.contractVersion,
        visibilityTimeoutSeconds: form.visibilityTimeoutSeconds,
        maxAttempts: form.maxAttempts,
        enabled: form.enabled,
        replaySince: form.replaySince || null
      })
    }
    emit('success', kind.value)
    return true
  }

  async function handleOpen(nextKind: ConfigKind): Promise<void> {
    kind.value = nextKind
    users.value = []
    await dialogRef.value?.handleOpen(undefined, {
      title: { steward: '配置数据责任人', rule: '发布质量规则新版本', consumer: '配置下游消费者' }[
        nextKind
      ],
      confirmText: '保存配置',
      loading: nextKind === 'steward',
      loadingText: '正在加载责任人…',
      onOpen: async (_openData, api) => {
        if (nextKind !== 'steward') return
        try {
          users.value = await fetchMdmGovernanceUsers()
        } catch {
          ElMessage.warning('责任人加载失败，请关闭弹窗后重试')
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: submit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .governance-config-dialog {
    display: grid;
    gap: 18px;

    &__context {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 11px;
      padding: 13px 14px;
      background: var(--el-fill-color-lighter);
      border: 1px solid var(--el-border-color-lighter);
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
        font-size: 11px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
