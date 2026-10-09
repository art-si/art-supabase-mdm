<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="code-rule-dialog">
      <ArtEntitySummary
        icon="ri:barcode-box-line"
        eyebrow="SUPPLY CHAIN CODE RULE"
        :title="form.model.ruleName || '新供应链编码规则'"
        :description="
          form.model.ruleCode
            ? `规则编码：${form.model.ruleCode}`
            : '配置批号、序列号和跟踪号的统一编码结构。'
        "
      >
        <template #aside>
          <ElTag :type="form.model.status === 'enabled' ? 'success' : 'info'" effect="light">
            {{ form.model.status === 'enabled' ? '启用' : '停用' }}
          </ElTag>
        </template>
      </ArtEntitySummary>

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
      >
        <template #scope>
          <div class="code-rule-dialog__scope" role="group" aria-label="适用范围">
            <ElCheckbox v-model="form.model.applyBatch" border>适用批号</ElCheckbox>
            <ElCheckbox v-model="form.model.applySerial" border>适用序列号</ElCheckbox>
            <ElCheckbox v-model="form.model.applyTracking" border>适用跟踪号</ElCheckbox>
          </div>
        </template>
      </ArtForm>

      <ArtSectionCard
        title="编码设置"
        :subtitle="`${form.model.segments.length} 个编码属性；拖动顺序由上下移动操作控制，编码示例将实时更新。`"
        preserve-content-structure
      >
        <template #actions>
          <ArtTableMultipleSelect
            v-model="selectedAttributeCodes"
            v-model:selected-data="selectedAttributeRows"
            title="选择编码属性"
            subtitle="属性来自统一编码属性库；已选属性可在右侧确认后加入规则。"
            row-key="attributeCode"
            label-key="attributeName"
            description-key="description"
            :data="selectableAttributes"
            :columns="attributeColumns"
            :show-pagination="false"
            @confirm="applySelectedAttributes"
          >
            <template #trigger="{ open }">
              <ElButton type="primary" plain @click="open">
                <ArtSvgIcon icon="ri:add-line" />选择编码属性
              </ElButton>
            </template>
          </ArtTableMultipleSelect>
        </template>

        <div class="code-rule-dialog__preview" aria-live="polite">
          <span><ArtSvgIcon icon="ri:eye-line" />编码示例</span>
          <strong>{{ preview || '请选择编码属性' }}</strong>
          <small>{{ preview.length }} 位</small>
        </div>

        <ElAlert
          v-if="form.detailError"
          :title="form.detailError"
          type="error"
          :closable="false"
          show-icon
        />

        <ArtTable
          ref="segmentTableRef"
          :data="form.model.segments"
          :columns="segmentColumns"
          :show-pagination="false"
          max-height="360"
          empty-text="尚未选择编码属性"
          empty-description="点击右上角“选择编码属性”，建立固定值、日期、文本或流水号组合。"
        />
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { cloneDeep } from 'lodash-es'
  import { ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    fetchSupplyChainCodeAttributes,
    saveSupplyChainCodeRule,
    type SupplyChainCodeAttribute,
    type SupplyChainCodeRule,
    type SupplyChainCodeRuleInput,
    type SupplyChainCodeSegment
  } from '@mdm/api'
  import { buildSupplyChainCodePreview } from './rule-preview'

  export interface SupplyChainCodeRuleDialogOpenData {
    row?: SupplyChainCodeRule
    copy?: boolean
  }

  interface AttributeSelectRow extends SupplyChainCodeAttribute, DataSelectRecord {}
  interface RuleFormModel extends SupplyChainCodeRuleInput {
    id?: string
    tenantId: string
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<SupplyChainCodeRuleDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const segmentTableRef = ref<ArtTableExpose>()
  const { effectiveTenantId, tenantOptions } = storeToRefs(useTenantScopeStore())
  const statusOptions = useDictionaryOptions('commonEnabledStatus')
  const useModeOptions = useDictionaryOptions('mdmSupplyChainCodeUseMode')
  const dateFormatOptions = useDictionaryOptions('mdmSupplyChainCodeDateFormat')

  const initialForm = (): RuleFormModel => ({
    id: undefined,
    tenantId: effectiveTenantId.value || '',
    ruleCode: '',
    ruleName: '',
    exampleCode: '',
    applyBatch: true,
    applySerial: false,
    applyTracking: false,
    perMaterial: true,
    separator: '',
    status: 'enabled',
    remark: '',
    segments: []
  })
  const form = reactive({
    model: initialForm(),
    attributes: [] as SupplyChainCodeAttribute[],
    detailError: ''
  })
  const selectedAttributeCodes = ref<Array<string | number>>([])
  const selectedAttributeRows = ref<DataSelectRecord[]>([])
  const selectableAttributes = computed<AttributeSelectRow[]>(() =>
    form.attributes.map((item) => ({ ...item }))
  )
  const preview = computed(() =>
    buildSupplyChainCodePreview(form.model.segments, form.model.separator)
  )
  const attributeTypeLabels = {
    constant: '常量',
    date: '日期',
    sequence: '流水号',
    text: '文本'
  } satisfies Record<SupplyChainCodeAttribute['attributeType'], string>
  const attributeColumns: DataSelectColumn[] = [
    { prop: 'attributeCode', label: '编码', width: 170 },
    { prop: 'attributeName', label: '属性名称', minWidth: 150 },
    {
      prop: 'attributeType',
      label: '属性类型',
      width: 110,
      formatter: (row) =>
        attributeTypeLabels[row.attributeType as SupplyChainCodeAttribute['attributeType']] ?? '—'
    },
    { prop: 'description', label: '说明', minWidth: 220 }
  ]
  const formItems = computed<FormItem[]>(() => [
    {
      label: '目标租户',
      key: 'tenantId',
      type: 'select',
      options: tenantOptions.value,
      props: {
        disabled: Boolean(form.model.id),
        filterable: true,
        placeholder: '请选择规则归属租户'
      }
    },
    { label: '基本信息', key: 'identity', type: 'divider', span: 24 },
    {
      label: '规则编码',
      key: 'ruleCode',
      type: 'input',
      props: { maxlength: 40, placeholder: '如 PH001、XLH' },
      help: '以字母开头，仅支持字母、数字、下划线和短横线。'
    },
    {
      label: '规则名称',
      key: 'ruleName',
      type: 'input',
      props: { maxlength: 100, placeholder: '如 批号规则' }
    },
    {
      label: '段间分隔符',
      key: 'separator',
      type: 'input',
      props: { maxlength: 5, placeholder: '可留空，或输入 - / 等字符' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'segment',
      options: statusOptions
    },
    { label: '适用范围', key: 'scopeDivider', type: 'divider', span: 24 },
    { label: '业务对象', key: 'scope', type: 'slot', span: 16 },
    {
      label: '每个物料单独编码',
      key: 'perMaterial',
      type: 'switch',
      span: 8,
      props: { activeText: '单独编码', inactiveText: '共用编码' }
    },
    {
      label: '规则说明',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 2, maxlength: 500, showWordLimit: true, resize: 'none' }
    }
  ])
  const formRules = {
    tenantId: [{ required: true, message: '请选择目标租户', trigger: 'change' }],
    ruleCode: [
      { required: true, message: '请输入规则编码', trigger: 'blur' },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: '规则编码格式不正确', trigger: 'blur' }
    ],
    ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }]
  }

  const rowIndex = (row: SupplyChainCodeSegment): number => form.model.segments.indexOf(row)
  const moveSegment = (index: number, offset: -1 | 1): void => {
    const target = index + offset
    if (target < 0 || target >= form.model.segments.length) return
    const [row] = form.model.segments.splice(index, 1)
    form.model.segments.splice(target, 0, row)
    form.model.segments.forEach((item, position) => (item.sort = (position + 1) * 10))
  }
  const removeSegment = (index: number): void => {
    form.model.segments.splice(index, 1)
    selectedAttributeCodes.value = form.model.segments.map((item) => item.attributeCode)
    selectedAttributeRows.value = selectableAttributes.value.filter((item) =>
      selectedAttributeCodes.value.includes(item.attributeCode)
    )
  }
  const selectSequenceSource = (row: SupplyChainCodeSegment, value: boolean): void => {
    if (value) {
      form.model.segments.forEach((item) => (item.sequenceSource = item === row))
    } else row.sequenceSource = false
  }
  const segmentColumns = computed<ColumnOption<SupplyChainCodeSegment>[]>(() => [
    { type: 'index', label: '#', width: 48, align: 'center' },
    {
      prop: 'attributeCode',
      label: '编码属性',
      minWidth: 180,
      formatter: (row) => (
        <div class="code-rule-dialog__attribute">
          <strong>{row.attribute?.attributeName || row.attributeCode}</strong>
          <small>{row.attributeCode}</small>
        </div>
      )
    },
    {
      prop: 'useMode',
      label: '使用模式',
      width: 120,
      formatter: (row) => (
        <ElSelect v-model={row.useMode} aria-label="使用模式">
          {useModeOptions.map((option) => (
            <ElOption key={option.value} label={option.label} value={option.value} />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'format',
      label: '格式 / 设置值',
      minWidth: 160,
      rules: {
        validator: ({ row }) =>
          row.attributeCode !== 'CONSTANT' || Boolean(row.configuredValue.trim()),
        message: ({ rowIndex }) => `第 ${rowIndex + 1} 行常量必须填写设置值`
      },
      formatter: (row) =>
        row.attribute?.attributeType === 'date' ? (
          <ElSelect v-model={row.format} aria-label="日期格式">
            {dateFormatOptions.map((option) => (
              <ElOption key={option.value} label={option.label} value={option.value} />
            ))}
          </ElSelect>
        ) : (
          <ElInput
            v-model={row.configuredValue}
            aria-label="编码设置值"
            maxlength={60}
            placeholder={row.attributeCode === 'CONSTANT' ? '输入固定值' : '可选设置值'}
          />
        )
    },
    {
      prop: 'length',
      label: '长度',
      width: 96,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.length}
          min={1}
          max={60}
          controls={false}
          aria-label="编码段长度"
        />
      )
    },
    {
      prop: 'step',
      label: '步长',
      width: 90,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.step}
          min={1}
          max={999999}
          controls={false}
          disabled={row.attribute?.attributeType !== 'sequence'}
          aria-label="流水步长"
        />
      )
    },
    {
      prop: 'paddingChar',
      label: '补位符',
      width: 90,
      formatter: (row) => <ElInput v-model={row.paddingChar} maxlength={1} aria-label="补位符号" />
    },
    {
      prop: 'sequenceSource',
      label: '流水依据',
      width: 92,
      align: 'center',
      formatter: (row) => (
        <ElSwitch
          v-model={row.sequenceSource}
          disabled={row.attribute?.attributeType !== 'sequence'}
          aria-label="设为流水号依据"
          onChange={(value) => selectSequenceSource(row, Boolean(value))}
        />
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 144,
      fixed: 'right',
      formatter: (row) => {
        const index = rowIndex(row)
        return (
          <>
            <ArtIconButton
              icon="ri:arrow-up-line"
              label={`上移第 ${index + 1} 个编码属性`}
              disabled={index === 0}
              onClick={() => moveSegment(index, -1)}
            />
            <ArtIconButton
              icon="ri:arrow-down-line"
              label={`下移第 ${index + 1} 个编码属性`}
              disabled={index === form.model.segments.length - 1}
              onClick={() => moveSegment(index, 1)}
            />
            <ArtIconButton
              tone="danger"
              icon="ri:close-line"
              label={`删除第 ${index + 1} 个编码属性`}
              onClick={() => removeSegment(index)}
            />
          </>
        )
      }
    }
  ])

  const createSegment = (
    attribute: SupplyChainCodeAttribute,
    sort: number
  ): SupplyChainCodeSegment => ({
    attributeCode: attribute.attributeCode,
    useMode: attribute.attributeType === 'constant' ? 'configured' : 'full',
    format: attribute.defaultFormat || '',
    configuredValue: '',
    length: attribute.attributeType === 'sequence' ? 6 : null,
    step: 1,
    paddingChar: '0',
    padDirection: 'left',
    truncate: false,
    sequenceSource: attribute.attributeCode === 'SEQUENCE',
    sort,
    attribute
  })
  const applySelectedAttributes = (): void => {
    const selected = new Map(
      selectedAttributeRows.value.map((row) => [String(row.attributeCode), row])
    )
    const retained = form.model.segments.filter((segment) => selected.has(segment.attributeCode))
    const retainedCodes = new Set(retained.map((segment) => segment.attributeCode))
    const added = selectedAttributeRows.value
      .filter((row) => !retainedCodes.has(String(row.attributeCode)))
      .map((row, index) =>
        createSegment(row as AttributeSelectRow, (retained.length + index + 1) * 10)
      )
    form.model.segments = [...retained, ...added].map((item, index) => ({
      ...item,
      sort: (index + 1) * 10
    }))
  }

  const submit = async (): Promise<boolean> => {
    form.detailError =
      !form.model.applyBatch && !form.model.applySerial && !form.model.applyTracking
        ? '请至少选择批号、序列号或跟踪号中的一种适用对象'
        : !form.model.segments.length
          ? '请至少选择一个编码属性'
          : ''
    if (form.detailError) return false
    try {
      const tableValidation = await segmentTableRef.value?.validate()
      if (tableValidation?.valid === false) {
        form.detailError = tableValidation.firstError?.message || '请完整配置编码属性'
        return false
      }
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '供应链编码规则校验未完成，请稍后重试', 'warning')
      return false
    }
    try {
      await saveSupplyChainCodeRule(
        form.model.tenantId,
        {
          ruleCode: form.model.ruleCode.trim().toUpperCase(),
          ruleName: form.model.ruleName.trim(),
          exampleCode: preview.value,
          applyBatch: form.model.applyBatch,
          applySerial: form.model.applySerial,
          applyTracking: form.model.applyTracking,
          perMaterial: form.model.perMaterial,
          separator: form.model.separator,
          status: form.model.status,
          remark: form.model.remark.trim(),
          segments: form.model.segments.map((item, index) => ({
            attributeCode: item.attributeCode,
            useMode: item.useMode,
            format: item.format,
            configuredValue: item.configuredValue,
            length: item.length,
            step: item.step,
            paddingChar: item.paddingChar,
            padDirection: item.padDirection,
            truncate: item.truncate,
            sequenceSource: item.sequenceSource,
            sort: (index + 1) * 10
          }))
        },
        form.model.id
      )
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '供应链编码规则保存失败，请检查编码属性后重试')
      return false
    }
  }

  async function handleOpen(data: SupplyChainCodeRuleDialogOpenData): Promise<void> {
    Object.assign(form.model, initialForm())
    Object.assign(form, { attributes: [], detailError: '' })
    selectedAttributeCodes.value = []
    selectedAttributeRows.value = []
    if (data.row) Object.assign(form.model, cloneDeep(data.row))
    if (data.copy) {
      form.model.id = undefined
      form.model.ruleCode = ''
      form.model.ruleName = `${form.model.ruleName}（副本）`
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.copy
        ? '复制供应链编码规则'
        : form.model.id
          ? '编辑供应链编码规则'
          : '新增供应链编码规则',
      subtitle: '维护业务适用范围、编码属性顺序和流水生成参数',
      confirmText: form.model.id ? '保存更改' : '创建规则',
      contentMaxHeight: '74vh',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          form.attributes = await fetchSupplyChainCodeAttributes()
          form.model.segments = form.model.segments.map((segment) => ({
            ...segment,
            attribute:
              form.attributes.find((item) => item.attributeCode === segment.attributeCode) ||
              segment.attribute
          }))
          selectedAttributeCodes.value = form.model.segments.map((item) => item.attributeCode)
          selectedAttributeRows.value = selectableAttributes.value.filter((item) =>
            selectedAttributeCodes.value.includes(item.attributeCode)
          )
          formRef.value?.clearValidate()
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
  .code-rule-dialog {
    display: grid;
    gap: 18px;
    min-width: 0;

    &__scope {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      :deep(.el-checkbox) {
        margin-right: 0;
      }
    }

    &__preview {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 12px 14px;
      margin-bottom: 12px;
      background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      border-radius: var(--el-border-radius-base);

      span {
        display: inline-flex;
        gap: 6px;
        align-items: center;
        color: var(--el-text-color-secondary);
      }

      strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 16px;
        color: var(--theme-color);
        white-space: nowrap;
      }

      small {
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.code-rule-dialog__attribute) {
      display: grid;

      small {
        margin-top: 2px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.el-input-number),
    :deep(.el-select),
    :deep(.art-table__cell-content),
    :deep(.art-table__cell-value) {
      width: 100%;
    }

    @media (width <= 820px) {
      &__preview {
        grid-template-columns: 1fr auto;

        strong {
          grid-row: 2;
          grid-column: 1 / -1;
        }
      }
    }
  }
</style>
