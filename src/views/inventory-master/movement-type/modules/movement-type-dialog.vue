<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="space-y-4">
      <ArtEntitySummary
        icon="ri:swap-box-line"
        eyebrow="INVENTORY MOVEMENT"
        :title="form.movementName || (mode === 'copy' ? '复制出入库类型' : '新建出入库类型')"
        :description="form.movementCode || '定义稳定的移动编码、库存方向与冲销关系。'"
      />
      <ElAlert v-if="optionError" type="warning" :closable="false" show-icon>
        类型选项加载失败，请重新加载后保存。
        <ElButton link type="primary" @click="loadOptions">重新加载</ElButton>
      </ElAlert>
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
        :validate-on-rule-change="false"
        scroll-to-error
      />
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { storeToRefs } from 'pinia'
  import { ElButton, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, {
    type FormItem,
    type FormItemOption
  } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchMovementTypeOptions,
    saveMovementType,
    type MovementDirection,
    type MovementTypeInput,
    type MovementTypeRecord
  } from '@mdm/api'

  export interface MovementTypeDialogOpenData {
    mode: 'add' | 'edit' | 'copy'
    row?: MovementTypeRecord
    tenantId?: string | null
  }

  type FormModel = MovementTypeInput & { id: string }
  const emit = defineEmits<{ success: [] }>()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap } = storeToRefs(userStore)
  const { tenantOptions } = storeToRefs(tenantScopeStore)
  const { shouldExposeTenantField } = useTenantScopeFormPolicy()
  const dialogRef = ref<ArtDialogExpose<MovementTypeDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const mode = ref<MovementTypeDialogOpenData['mode']>('add')
  const optionError = ref(false)
  const createModel = (): FormModel => ({
    id: '',
    tenantId: '',
    movementCode: '',
    movementName: '',
    direction: '' as MovementDirection,
    reverseTypeId: null,
    reversal: false,
    otherIo: false,
    status: 'enabled',
    remark: null
  })
  const form = reactive<FormModel>(createModel())

  const items = computed<FormItem[]>(() => [
    ...(shouldExposeTenantField.value
      ? [
          { key: 'tenantSection', label: '数据归属', type: 'divider' as const, span: 24 },
          {
            key: 'tenantId',
            label: '所属租户',
            type: 'select' as const,
            span: 24,
            options: tenantOptions.value.map((tenant) => ({
              label: `${tenant.tenantName} · ${tenant.tenantCode}`,
              value: tenant.id
            })),
            props: {
              filterable: true,
              disabled: mode.value !== 'add',
              placeholder: '请选择出入库类型所属租户',
              onChange: () => {
                form.reverseTypeId = null
                void formRef.value?.reloadOptions('reverseTypeId')
              }
            },
            help: '在全部租户视图新增时，明确选择数据归属。'
          }
        ]
      : []),
    { key: 'identity', label: '类型标识', type: 'divider', span: 24 },
    {
      key: 'movementCode',
      label: '移动类型编码',
      type: 'input',
      props: { maxlength: 40, placeholder: '如 101 或 PURCHASE_IN', clearable: true },
      help: '同一租户内编码唯一，建议保持稳定。'
    },
    {
      key: 'movementName',
      label: '移动类型名称',
      type: 'input',
      props: { maxlength: 100, placeholder: '如 采购入库', clearable: true }
    },
    {
      key: 'direction',
      label: '出入库类型',
      type: 'segment',
      span: 24,
      options: getDictMap.value.mdmStockMovementDirection ?? []
    },
    {
      key: 'reverseTypeId',
      label: '反向类型',
      type: 'select',
      span: 24,
      api: async () => ({
        data: (await fetchMovementTypeOptions(form.tenantId ?? '')).filter(
          (item) => item.id !== form.id
        )
      }),
      immediate: false,
      resultField: 'data',
      valueField: 'id',
      labelField: 'movementName',
      labelFn: (option: FormItemOption) =>
        `${option.movementCode ?? ''} · ${option.movementName ?? ''}`,
      props: {
        clearable: true,
        filterable: true,
        disabled: !form.tenantId,
        placeholder: '可选；从同租户出入库类型中选择'
      },
      help: '用于退回或冲销场景，不能选择当前类型自身。'
    },
    { key: 'control', label: '业务控制', type: 'divider', span: 24 },
    {
      key: 'reversal',
      label: '冲销标志',
      type: 'switch',
      props: { activeText: '是', inactiveText: '否' }
    },
    {
      key: 'otherIo',
      label: '其他出入库',
      type: 'switch',
      props: { activeText: '是', inactiveText: '否' }
    },
    {
      key: 'status',
      label: '启用标志',
      type: 'switch',
      props: {
        activeValue: 'enabled',
        inactiveValue: 'disabled',
        activeText: '启用',
        inactiveText: '禁用'
      }
    },
    {
      key: 'remark',
      label: '备注',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true, resize: 'none' }
    }
  ])
  const rules: FormRules<FormModel> = {
    tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
    movementCode: [
      { required: true, message: '请输入移动类型编码', trigger: 'blur' },
      {
        pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
        message: '编码仅支持字母、数字、下划线和短横线',
        trigger: 'blur'
      }
    ],
    movementName: [{ required: true, message: '请输入移动类型名称', trigger: 'blur' }],
    direction: [{ required: true, message: '请选择出入库类型', trigger: 'change' }]
  }

  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (optionError.value) return false
      await saveMovementType(
        {
          tenantId: form.tenantId,
          movementCode: form.movementCode.trim().toUpperCase(),
          movementName: form.movementName.trim(),
          direction: form.direction,
          reverseTypeId: form.reverseTypeId || null,
          reversal: form.reversal,
          otherIo: form.otherIo,
          status: form.status,
          remark: form.remark
        },
        mode.value === 'edit' ? form.id : undefined
      )
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '库存移动类型保存失败，请检查填写内容和网络后重试')
      return false
    }
  }

  async function loadOptions(): Promise<void> {
    optionError.value = false
    try {
      await tenantScopeStore.loadTenantOptions()
      await userStore.ensureDictLoaded('mdmStockMovementDirection')
      await formRef.value?.reloadOptions('reverseTypeId')
    } catch {
      optionError.value = true
    }
  }

  async function handleOpen(data: MovementTypeDialogOpenData): Promise<void> {
    mode.value = data.mode
    Object.assign(form, createModel(), data.row ?? {})
    form.tenantId = data.row?.tenantId || data.tenantId || ''
    if (data.mode === 'copy') {
      form.id = ''
      form.movementCode = ''
      form.movementName = data.row?.movementName ? `${data.row.movementName}（副本）` : ''
    }
    await dialogRef.value?.handleOpen(data, {
      title:
        data.mode === 'edit'
          ? '编辑出入库类型'
          : data.mode === 'copy'
            ? '复制出入库类型'
            : '新增出入库类型',
      subtitle:
        data.mode === 'copy'
          ? '已继承原类型配置，请填写新编码。'
          : '定义移动类型及其业务控制标志。',
      confirmText: data.mode === 'edit' ? '保存更改' : '创建类型',
      loading: true,
      onOpen: async (_openData, api) => {
        try {
          await loadOptions()
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
