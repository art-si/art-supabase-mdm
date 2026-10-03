<template>
  <ArtDialog ref="dialogRef" size="lg">
    <div class="warehouse-dialog">
      <ArtEntitySummary
        icon="ri:store-2-line"
        eyebrow="WAREHOUSE MASTER"
        :title="form.model.warehouseName || '新仓库'"
        :description="warehouseDescription"
      >
        <template #aside>
          <ElTag :type="form.model.status === 'enabled' ? 'success' : 'info'" effect="light">
            {{ form.model.status === 'enabled' ? '启用' : '停用' }}
          </ElTag>
        </template>
      </ArtEntitySummary>

      <ElAlert v-if="organizationLoadError" type="warning" :closable="false" show-icon>
        库存组织加载失败，请重试后保存仓库。
        <ElButton link type="primary" @click="loadOrganizations">重新加载</ElButton>
      </ElAlert>

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
        root-class="warehouse-identity-form"
      >
        <template #responsibleEmployeeId>
          <ArtEmployeeSelect
            :model-value="form.model.responsibleEmployeeId || undefined"
            :selected-data="form.selectedEmployee"
            :tenant-id="form.tenantId"
            title="选择仓库负责人"
            subtitle="人员来源于当前租户的员工花名册"
            placeholder="从员工花名册选择负责人"
            :display-fields="['organization', 'jobTitle', 'employmentStatus']"
            @update:model-value="form.model.responsibleEmployeeId = $event || null"
            @update:selected-data="form.selectedEmployee = $event"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { cloneDeep } from 'lodash-es'
  import { storeToRefs } from 'pinia'
  import { useUserStore } from '@/store/modules/user'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import { fetchGetEnableOrganizationOptionsList } from '@/api/system-manage'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import {
    saveWarehouse,
    type WarehouseGroup,
    type WarehouseInput,
    type WarehouseRecord
  } from '@mdm/api'

  const commonEnabledDisabledStatusOptions = useDictionaryOptions('commonEnabledDisabledStatus')

  export interface WarehouseDialogOpenData {
    row?: WarehouseRecord
    copy?: boolean
    tenantId: string
    groups: WarehouseGroup[]
    selectedGroupId?: string
  }

  const emit = defineEmits<{ success: [mode: 'add' | 'edit'] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  void userStore.ensureDictLoaded('mdmWarehouseType')
  void userStore.ensureDictLoaded('mdmWarehouseBusinessScope')
  const dialogRef = ref<ArtDialogExpose<WarehouseDialogOpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const organizationLoadError = ref(false)
  const initialForm = (): WarehouseInput & { id?: string; singleSkuPerBinChoice: string } => ({
    id: undefined,
    groupId: null,
    organizationId: '',
    warehouseCode: '',
    warehouseName: '',
    responsibleEmployeeId: null,
    warehouseType: 'raw_material',
    businessScopes: ['picking', 'availability', 'warning'],
    enableLocations: false,
    enableZones: false,
    singleSkuPerBin: false,
    singleSkuPerBinChoice: 'false',
    remark: '',
    status: 'enabled'
  })
  const form = reactive({
    model: initialForm(),
    tenantId: '',
    groups: [] as WarehouseGroup[],
    organizations: [] as Array<{ id: string; organizationCode: string; organizationName: string }>,
    selectedEmployee: [] as EmployeeIntegrationItem[]
  })
  const warehouseDescription = computed(() =>
    form.model.warehouseCode
      ? `仓库编码：${form.model.warehouseCode}`
      : '建立可被采购、库存和出库业务稳定引用的仓库身份。'
  )
  const formItems = computed<FormItem[]>(() => [
    {
      key: 'identity',
      label: '仓库身份',
      type: 'divider',
      span: 24
    },
    {
      label: '仓库编码',
      key: 'warehouseCode',
      type: 'input',
      props: { maxlength: 40, placeholder: '如 WH_FINISHED_01' },
      help: '以字母开头，仅支持字母、数字、下划线和短横线。'
    },
    {
      label: '仓库名称',
      key: 'warehouseName',
      type: 'input',
      props: { maxlength: 100, placeholder: '如 一号成品仓' }
    },
    {
      label: '仓库类型',
      key: 'warehouseType',
      type: 'select',
      options: getDictMap.value.mdmWarehouseType ?? [],
      props: { placeholder: '选择仓库类型' }
    },
    {
      label: '库存组织',
      key: 'organizationId',
      type: 'select',
      options: form.organizations.map((item) => ({
        label: `${item.organizationName} · ${item.organizationCode}`,
        value: item.id
      })),
      props: { filterable: true, placeholder: '选择库存所属组织' },
      help: '新入库默认归属此组织；跨组织物料转移须走 WMS 调拨单。'
    },
    {
      label: '仓库分组',
      key: 'groupId',
      type: 'select',
      options: form.groups
        .filter((item) => item.enabled)
        .map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id })),
      props: { clearable: true, filterable: true, placeholder: '选择仓库分组' }
    },
    {
      label: '仓库负责人',
      key: 'responsibleEmployeeId',
      type: 'slot'
    },
    {
      key: 'operation',
      label: '业务控制',
      type: 'divider',
      span: 24
    },
    {
      label: '业务应用范围',
      key: 'businessScopes',
      type: 'select',
      span: 24,
      options: getDictMap.value.mdmWarehouseBusinessScope ?? [],
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        placeholder: '选择适用业务'
      }
    },
    {
      label: '启用库区',
      key: 'enableZones',
      type: 'switch',
      props: { activeText: '启用', inactiveText: '关闭' },
      help: '可单独启用库区。未启用库位时，物料可存放在仓库或具体库区。'
    },
    {
      label: '启用库位',
      key: 'enableLocations',
      type: 'switch',
      props: { activeText: '启用', inactiveText: '关闭' },
      help: '可单独启用库位并直挂仓库；启用后出入库必须选择具体库位。'
    },
    ...(form.model.enableLocations
      ? [
          {
            label: '一位一品',
            key: 'singleSkuPerBinChoice',
            type: 'select' as const,
            options: getDictMap.value.commonBoolean ?? [],
            props: { placeholder: '请选择是否一位一品' },
            help: '启用后每个库位只能存放一种物料。'
          }
        ]
      : []),
    {
      label: '启用状态',
      key: 'status',
      type: 'segment',
      options: commonEnabledDisabledStatusOptions
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
    warehouseCode: [
      { required: true, message: '请输入仓库编码', trigger: 'blur' },
      { pattern: /^[A-Za-z][A-Za-z0-9_-]*$/, message: '编码格式不正确', trigger: 'blur' }
    ],
    warehouseName: [{ required: true, message: '请输入仓库名称', trigger: 'blur' }],
    warehouseType: [{ required: true, message: '请选择仓库类型', trigger: 'change' }],
    organizationId: [{ required: true, message: '请选择库存组织', trigger: 'change' }],
    businessScopes: [
      {
        required: true,
        type: 'array' as const,
        min: 1,
        message: '至少选择一个业务应用范围',
        trigger: 'change'
      }
    ]
  }
  watch(
    () => form.model.enableLocations,
    (enabled) => {
      if (!enabled) {
        form.model.singleSkuPerBin = false
        form.model.singleSkuPerBinChoice = 'false'
      }
    }
  )

  const submit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      if (organizationLoadError.value) return false
      await saveWarehouse(
        {
          groupId: form.model.groupId || null,
          organizationId: form.model.organizationId,
          warehouseCode: form.model.warehouseCode.trim().toUpperCase(),
          warehouseName: form.model.warehouseName.trim(),
          responsibleEmployeeId: form.model.responsibleEmployeeId || null,
          warehouseType: form.model.warehouseType,
          businessScopes: form.model.businessScopes,
          enableLocations: form.model.enableLocations,
          enableZones: form.model.enableZones,
          singleSkuPerBin:
            form.model.enableLocations && form.model.singleSkuPerBinChoice === 'true',
          remark: form.model.remark.trim(),
          status: form.model.status
        },
        form.model.id
      )
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '仓库档案保存失败，请检查填写内容和网络后重试')
      return false
    }
  }

  async function loadOrganizations(): Promise<void> {
    organizationLoadError.value = false
    try {
      const result = await fetchGetEnableOrganizationOptionsList(form.tenantId)
      form.organizations = (result.data ?? []).filter(
        (item): item is typeof item & { id: string } => Boolean(item.id)
      )
      if (!form.model.organizationId && form.organizations.length) {
        form.model.organizationId =
          form.organizations.find((item) => item.organizationCode === 'ROOT')?.id ||
          form.organizations[0].id
      }
    } catch {
      form.organizations = []
      organizationLoadError.value = true
    }
  }

  async function handleOpen(data: WarehouseDialogOpenData): Promise<void> {
    Object.assign(form.model, initialForm())
    Object.assign(form, {
      tenantId: data.row?.tenantId || data.tenantId,
      groups: cloneDeep(data.groups),
      organizations: []
    })
    form.selectedEmployee = []
    if (data.row) {
      Object.assign(form.model, cloneDeep(data.row))
      form.model.singleSkuPerBinChoice = data.row.singleSkuPerBin ? 'true' : 'false'
      if (data.row.responsible) {
        form.selectedEmployee = [
          {
            id: data.row.responsible.id,
            tenantId: data.row.responsible.tenantId,
            employeeNo: data.row.responsible.employeeNo,
            employeeName: data.row.responsible.employeeName,
            jobTitle: data.row.responsible.jobTitle,
            employmentStatus: data.row.responsible.employmentStatus || 'active',
            organization: data.row.responsible.organization || undefined
          }
        ]
      }
    } else form.model.groupId = data.selectedGroupId || null
    if (data.copy) {
      form.model.id = undefined
      form.model.warehouseCode = ''
      form.model.warehouseName = `${form.model.warehouseName}（副本）`
    }
    await dialogRef.value?.handleOpen(data, {
      title: data.copy ? '复制仓库' : form.model.id ? '编辑仓库' : '新增仓库',
      subtitle: '库区与库位可独立启用，也可组合使用',
      confirmText: form.model.id ? '保存更改' : '创建仓库',
      contentMaxHeight: 'min(70vh, calc(100vh - 200px))',
      loading: true,
      loadingText: '正在加载库存组织与表单选项…',
      onConfirm: submit,
      onOpen: async (_openData, api) => {
        formRef.value?.clearValidate()
        try {
          await Promise.all([userStore.ensureDictLoaded('commonBoolean'), loadOrganizations()])
        } finally {
          api.setLoading(false)
        }
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .warehouse-dialog {
    display: grid;
    gap: 18px;
  }

  @media (width <= 767px) {
    :deep(.warehouse-identity-form .el-col) {
      flex: 0 0 100%;
      max-width: 100%;
    }
  }
</style>
