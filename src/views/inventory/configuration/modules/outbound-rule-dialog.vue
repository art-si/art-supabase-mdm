<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="outbound-rule-dialog">
      <ArtEntitySummary
        icon="ri:route-line"
        eyebrow="OUTBOUND SORT POLICY"
        :title="form.model.ruleName || '新出库规则'"
        :description="
          form.model.ruleCode
            ? `规则编码：${form.model.ruleCode}`
            : '按有序字段组合确定库存出库优先级。'
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
      />

      <ArtSectionCard
        title="排序优先级"
        :subtitle="`${form.model.sorts.length} 个排序字段；列表顺序即出库决策顺序。`"
        preserve-content-structure
      >
        <template #actions>
          <ElButton type="primary" plain :disabled="form.model.sorts.length >= 12" @click="addSort">
            <ArtSvgIcon icon="ri:add-line" />添加排序字段
          </ElButton>
        </template>

        <div class="outbound-rule-dialog__hint">
          <ArtSvgIcon icon="ri:information-line" />
          <span>系统先比较第 1 行；值相同时继续比较下一行，最多配置 12 个字段。</span>
        </div>
        <ElAlert
          v-if="form.detailError"
          :title="form.detailError"
          type="error"
          :closable="false"
          show-icon
        />

        <ArtTable
          ref="sortTableRef"
          :data="form.model.sorts"
          :columns="sortColumns"
          :show-pagination="false"
          max-height="360"
          empty-text="尚未配置排序字段"
          empty-description="点击“添加排序字段”，确定出库优先级。"
        />
      </ArtSectionCard>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { cloneDeep } from 'lodash-es'
  import { ElOption, ElSelect } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import type { ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import {
    fetchOutboundSortFields,
    saveOutboundRule,
    type OutboundRule,
    type OutboundRuleInput,
    type OutboundRuleSort,
    type OutboundSortField
  } from '@mdm/api'

  const commonEnabledStatusOptions = useDictionaryOptions('commonEnabledStatus')

  export interface OutboundRuleDialogOpenData {
    row?: OutboundRule
    copy?: boolean
  }

  interface OutboundRuleFormModel extends OutboundRuleInput {
    id?: string
    tenantId: string
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<OutboundRuleDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const sortTableRef = ref<ArtTableExpose>()
  const { effectiveTenantId, tenantOptions } = storeToRefs(useTenantScopeStore())

  const initialForm = (): OutboundRuleFormModel => ({
    id: undefined,
    tenantId: effectiveTenantId.value || '',
    ruleCode: '',
    ruleName: '',
    status: 'enabled',
    remark: '',
    sorts: []
  })
  const form = reactive({
    model: initialForm(),
    fields: [] as OutboundSortField[],
    detailError: ''
  })
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
      props: { maxlength: 40, placeholder: '如 CKGZ-001' },
      help: '以字母开头，仅支持字母、数字、下划线和短横线。'
    },
    {
      label: '出库规则名称',
      key: 'ruleName',
      type: 'input',
      props: { maxlength: 100, placeholder: '如 顺序出库-最早入库日期' }
    },
    {
      label: '启用状态',
      key: 'status',
      type: 'segment',
      options: commonEnabledStatusOptions
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
    ruleName: [{ required: true, message: '请输入出库规则名称', trigger: 'blur' }]
  }

  const fieldByCode = (code: string): OutboundSortField | undefined =>
    form.fields.find((item) => item.fieldCode === code)
  const rowIndex = (row: OutboundRuleSort): number => form.model.sorts.indexOf(row)
  const availableFields = (row: OutboundRuleSort): OutboundSortField[] => {
    const used = new Set(
      form.model.sorts.filter((item) => item !== row).map((item) => item.fieldCode)
    )
    return form.fields.filter((item) => !used.has(item.fieldCode))
  }
  const syncField = (row: OutboundRuleSort): void => {
    row.field = fieldByCode(row.fieldCode) || null
    if (!row.field?.allowedDirections.includes(row.direction)) row.direction = 'asc'
  }
  const createSort = (sort: number): OutboundRuleSort => {
    const used = new Set(form.model.sorts.map((item) => item.fieldCode))
    const field = form.fields.find((item) => !used.has(item.fieldCode))
    return {
      fieldCode: field?.fieldCode || '',
      direction: field?.allowedDirections[0] || 'asc',
      sort,
      field: field || null
    }
  }
  const addSort = (): void => {
    if (form.model.sorts.length >= 12) return
    form.model.sorts.push(createSort((form.model.sorts.length + 1) * 10))
  }
  const moveSort = (index: number, offset: -1 | 1): void => {
    const target = index + offset
    if (target < 0 || target >= form.model.sorts.length) return
    const [row] = form.model.sorts.splice(index, 1)
    form.model.sorts.splice(target, 0, row)
    form.model.sorts.forEach((item, position) => (item.sort = (position + 1) * 10))
  }
  const sortColumns = computed<ColumnOption<OutboundRuleSort>[]>(() => [
    { type: 'index', label: '优先级', width: 72, align: 'center' },
    {
      prop: 'fieldCode',
      label: '排序字段名称',
      required: true,
      minWidth: 220,
      formatter: (row) => (
        <ElSelect
          v-model={row.fieldCode}
          filterable
          aria-label="排序字段名称"
          placeholder="选择排序字段"
          onChange={() => syncField(row)}
        >
          {availableFields(row).map((field) => (
            <ElOption
              key={field.fieldCode}
              label={`${field.fieldName} · ${field.sourceName}`}
              value={field.fieldCode}
            />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'sourceName',
      label: '字段来源',
      minWidth: 170,
      formatter: (row) => row.field?.sourceName || '—'
    },
    {
      prop: 'fieldKey',
      label: '排序字段标识',
      minWidth: 150,
      formatter: (row) => (
        <code class="outbound-rule-dialog__field-key">{row.field?.fieldKey || '—'}</code>
      )
    },
    {
      prop: 'direction',
      label: '排序方式',
      width: 118,
      formatter: (row) => (
        <ElSelect v-model={row.direction} aria-label="排序方式">
          {(row.field?.allowedDirections || ['asc', 'desc']).map((direction) => (
            <ElOption
              key={direction}
              label={direction === 'asc' ? '升序' : '降序'}
              value={direction}
            />
          ))}
        </ElSelect>
      )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 132,
      fixed: 'right',
      formatter: (row) => {
        const index = rowIndex(row)
        return (
          <div class="outbound-rule-dialog__row-actions">
            <ArtIconButton
              icon="ri:arrow-up-line"
              label={`上移第 ${index + 1} 个排序字段`}
              disabled={index === 0}
              onClick={() => moveSort(index, -1)}
            />
            <ArtIconButton
              icon="ri:arrow-down-line"
              label={`下移第 ${index + 1} 个排序字段`}
              disabled={index === form.model.sorts.length - 1}
              onClick={() => moveSort(index, 1)}
            />
            <ArtIconButton
              class="outbound-rule-dialog__delete"
              icon="ri:delete-bin-6-line"
              label={`删除第 ${index + 1} 个排序字段`}
              onClick={() => form.model.sorts.splice(index, 1)}
            />
          </div>
        )
      }
    }
  ])

  const submit = async (): Promise<boolean> => {
    form.detailError = !form.model.sorts.length ? '请至少配置一个排序字段' : ''
    if (form.detailError) return false
    const validation = await sortTableRef.value?.validate()
    if (validation?.valid === false) {
      form.detailError = validation.firstError?.message || '请完整配置排序字段'
      return false
    }
    try {
      await formRef.value?.validate()
      await saveOutboundRule(
        form.model.tenantId,
        {
          ruleCode: form.model.ruleCode.trim().toUpperCase(),
          ruleName: form.model.ruleName.trim(),
          status: form.model.status,
          remark: form.model.remark.trim(),
          sorts: form.model.sorts.map((item, index) => ({
            fieldCode: item.fieldCode,
            direction: item.direction,
            sort: (index + 1) * 10
          }))
        },
        form.model.id
      )
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch {
      return false
    }
  }

  async function handleOpen(data: OutboundRuleDialogOpenData): Promise<void> {
    Object.assign(form.model, initialForm())
    Object.assign(form, { fields: [], detailError: '' })
    if (data.row) Object.assign(form.model, cloneDeep(data.row))
    if (data.copy) {
      form.model.id = undefined
      form.model.ruleCode = ''
      form.model.ruleName = `${form.model.ruleName}（副本）`
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.copy ? '复制出库规则' : form.model.id ? '编辑出库规则' : '新增出库规则',
      subtitle: '维护出库排序字段、优先级和升降序策略',
      confirmText: form.model.id ? '保存更改' : '创建规则',
      contentMaxHeight: '74vh',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          form.fields = await fetchOutboundSortFields()
          form.model.sorts = form.model.sorts.map((item) => ({
            ...item,
            field: fieldByCode(item.fieldCode) || item.field
          }))
          if (!form.model.sorts.length) addSort()
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
  .outbound-rule-dialog {
    display: grid;
    gap: 18px;
    min-width: 0;

    &__hint {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-light);
      border-radius: var(--el-border-radius-base);
    }

    :deep(.outbound-rule-dialog__field-key) {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      color: var(--theme-color);
    }

    :deep(.outbound-rule-dialog__row-actions) {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
    }

    :deep(.outbound-rule-dialog__delete) {
      color: var(--el-color-danger);
    }

    :deep(.el-select),
    :deep(.art-table__cell-content),
    :deep(.art-table__cell-value) {
      width: 100%;
    }
  }
</style>
