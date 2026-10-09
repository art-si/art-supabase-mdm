<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="workstation-dialog">
      <ArtEntitySummary
        icon="ri:layout-grid-line"
        eyebrow="WORKSTATION"
        :title="form.model.workstationName || '新工位'"
        :description="scopeDescription"
      >
        <template #aside>
          <ElTag :type="form.model.enabled ? 'success' : 'info'" effect="light">
            {{ form.model.enabled ? '启用' : '禁用' }}
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
        <template #responsiblePersonId>
          <ArtEmployeeSelect
            :model-value="form.model.responsiblePersonId || undefined"
            :selected-data="form.selectedPerson"
            :tenant-id="form.model.tenantId"
            :api-fn="fetchProductionPersonSelector"
            title="选择工位负责人"
            subtitle="人员来源于当前租户的生产人员配置"
            placeholder="选择工位负责人（可选）"
            search-placeholder="姓名 / 工号"
            :display-fields="['jobTitle', 'employmentStatus']"
            @update:model-value="form.model.responsiblePersonId = $event || null"
            @update:selected-data="form.selectedPerson = $event"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { cloneDeep } from 'lodash-es'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import {
    fetchProductionPersonSelector,
    saveWorkstation,
    type ProductionDepartment,
    type Workstation,
    type WorkstationInput,
    type WorkstationScopeCenter
  } from '@mdm/api'

  export interface WorkstationDialogOpenData {
    row?: Workstation
    copy?: boolean
    department: ProductionDepartment
    workCenter: WorkstationScopeCenter
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const dialogRef = ref<ArtDialogExpose<WorkstationDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()

  const initialForm = (): WorkstationInput & { id?: string } => ({
    id: undefined,
    tenantId: '',
    workstationCode: '',
    workstationName: '',
    departmentId: '',
    workCenterId: '',
    responsiblePersonId: null,
    andonSimNo: null,
    enabled: true,
    remark: ''
  })

  const form = reactive({
    model: initialForm(),
    departmentName: '',
    workCenterCode: '',
    workCenterName: '',
    selectedPerson: [] as EmployeeIntegrationItem[]
  })

  const booleanOptions = useDictionaryOptions(
    'commonBoolean',
    (value) => value === 'true' || value === '1'
  )

  const scopeDescription = computed(
    () => `${form.departmentName || '未选择车间'} / ${form.workCenterCode} · ${form.workCenterName}`
  )

  const formItems = computed<FormItem[]>(() => [
    { key: 'identity', label: '工位识别', type: 'divider', span: 24 },
    {
      key: 'workstationCode',
      label: '工位编号',
      type: 'input',
      props: { maxlength: 80, placeholder: '如 WS-A01', clearable: true },
      help: '同一租户内不可重复，建议采用产线与序号组合。'
    },
    {
      key: 'workstationName',
      label: '工位名称',
      type: 'input',
      props: { maxlength: 120, placeholder: '如 驾驶室装配一号位', clearable: true }
    },
    { key: 'assignment', label: '责任与设备', type: 'divider', span: 24 },
    {
      key: 'responsiblePersonId',
      label: '工位负责人',
      type: 'slot',
      help: '可选；用于现场异常通知与工位责任追溯。'
    },
    {
      key: 'andonSimNo',
      label: '安灯盒子 SIM 编号',
      type: 'input',
      props: { maxlength: 64, placeholder: '输入完整 SIM 编号', clearable: true }
    },
    { key: 'control', label: '可用性控制', type: 'divider', span: 24 },
    {
      key: 'enabled',
      label: '启用状态',
      type: 'segment',
      options: booleanOptions,
      help: '禁用后不再作为下游业务的新选项，历史记录保持不变。'
    },
    {
      key: 'remark',
      label: '备注',
      type: 'input',
      span: 24,
      props: {
        type: 'textarea',
        rows: 3,
        maxlength: 500,
        showWordLimit: true,
        resize: 'none',
        placeholder: '补充工位用途、设备或交接说明（可选）'
      }
    }
  ])

  const formRules = {
    workstationCode: [
      { required: true, message: '请输入工位编号', trigger: 'blur' },
      {
        pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
        message: '仅支持字母、数字、下划线和短横线',
        trigger: 'blur'
      }
    ],
    workstationName: [{ required: true, message: '请输入工位名称', trigger: 'blur' }]
  }

  const toSelectedPerson = (row: Workstation): EmployeeIntegrationItem[] => {
    if (!row.responsiblePerson) return []
    return [
      {
        id: row.responsiblePerson.id,
        tenantId: row.responsiblePerson.tenantId,
        employeeName: row.responsiblePerson.name,
        employeeNo: row.responsiblePerson.employeeNo,
        jobTitle: row.responsiblePerson.jobTitle,
        employmentStatus: row.responsiblePerson.enabled ? 'active' : 'inactive'
      }
    ]
  }

  const submit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await saveWorkstation(
        {
          tenantId: form.model.tenantId,
          workstationCode: form.model.workstationCode.trim().toUpperCase(),
          workstationName: form.model.workstationName.trim(),
          departmentId: form.model.departmentId,
          workCenterId: form.model.workCenterId,
          responsiblePersonId: form.model.responsiblePersonId || null,
          andonSimNo: normalizeNullableText(form.model.andonSimNo),
          enabled: form.model.enabled,
          remark: form.model.remark.trim()
        },
        form.model.id
      )
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '工位档案保存失败，请检查填写内容和网络后重试')
      return false
    }
  }

  async function handleOpen(data: WorkstationDialogOpenData): Promise<void> {
    Object.assign(form.model, initialForm())
    Object.assign(form, {
      departmentName: data.department.name,
      workCenterCode: data.workCenter.code,
      workCenterName: data.workCenter.name,
      selectedPerson: []
    })
    Object.assign(form.model, {
      tenantId: data.row?.tenantId || data.workCenter.tenantId,
      departmentId: data.row?.departmentId || data.department.id,
      workCenterId: data.row?.workCenterId || data.workCenter.id
    })

    if (data.row) {
      Object.assign(form.model, cloneDeep(data.row))
      form.selectedPerson = toSelectedPerson(data.row)
      form.departmentName = data.row.department?.name || data.department.name
      form.workCenterCode = data.row.workCenter?.code || data.workCenter.code
      form.workCenterName = data.row.workCenter?.name || data.workCenter.name
    }
    if (data.copy) {
      form.model.id = undefined
      form.model.workstationCode = ''
      form.model.workstationName = `${form.model.workstationName}（副本）`
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.copy ? '复制工位' : form.model.id ? '编辑工位' : '新增工位',
      subtitle: '维护装配工位身份、负责人、安灯设备和启用状态',
      confirmText: form.model.id ? '保存更改' : '创建工位',
      contentMaxHeight: 'min(70vh, calc(100vh - 200px))',
      onConfirm: submit,
      onOpen: () => formRef.value?.clearValidate()
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .workstation-dialog {
    display: grid;
    gap: 18px;
    min-width: 0;
  }
</style>
