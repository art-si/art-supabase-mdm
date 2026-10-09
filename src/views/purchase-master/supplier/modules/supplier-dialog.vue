<template>
  <ArtDialog ref="dialogRef" size="xl">
    <div class="supplier-dialog">
      <ArtEntitySummary spaced>
        <template #icon><ArtSvgIcon icon="ri:git-merge-line" /></template>
        <strong>一处建档，多系统复用</strong>
        <p>供应商身份供 SMIS、VMS 等业务实时引用。保存后可在详情中维护银行和联系人。</p>
      </ArtEntitySummary>

      <ArtForm
        ref="formRef"
        v-model="form.model"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #addressPicker>
          <ArtAddressPicker
            v-model:address-detail="form.model.addressDetail"
            v-model:longitude="form.model.longitude"
            v-model:latitude="form.model.latitude"
            v-model:coordinate-system="form.model.coordinateSystem"
            hide-region-selector
            show-coordinate-hint
            :show-locate-button="true"
            detail-label="详细地址"
            detail-placeholder="输入地址后地图检索，或直接打开地图选点"
            label-width="86px"
          />
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtAddressPicker from '@/components/core/forms/art-address-picker/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import {
    savePurchaseSupplier,
    type MasterGroup,
    type PurchaseSupplier,
    type PurchaseSupplierInput
  } from '@mdm/api'

  export interface SupplierDialogOpenData {
    row?: PurchaseSupplier
    tenantId: string
    tenantOptions: Array<{ label: string; value: string }>
    groups: MasterGroup[]
    initialGroupId?: string
  }

  interface SupplierForm extends Omit<
    PurchaseSupplierInput,
    | 'supplierGroup'
    | 'enterpriseNature'
    | 'industry'
    | 'contactPerson'
    | 'contactPhone'
    | 'region'
    | 'regionAdcode'
    | 'addressDetail'
    | 'remark'
  > {
    supplierGroup: string
    enterpriseNature: string
    industry: string
    contactPerson: string
    contactPhone: string
    region: string
    regionAdcode: string
    addressDetail: string
    remark: string
    addressPicker?: undefined
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [type: 'add' | 'edit'] }>()
  const supplierCategoryOptions = useDictionaryOptions('supplierCategory')
  const supplierTypeOptions = useDictionaryOptions('supplierType')
  const enterpriseNatureOptions = useDictionaryOptions('enterpriseNature')
  const industryOptions = useDictionaryOptions('supplierIndustry')
  const { isPlatformScope } = storeToRefs(useTenantScopeStore())
  const dialogRef = ref<ArtDialogExpose<SupplierDialogOpenData>>()
  const formRef = ref<FormExpose>()
  const groups = ref<MasterGroup[]>([])
  const tenantOptions = ref<Array<{ label: string; value: string }>>([])

  const initialForm = (): SupplierForm => ({
    id: undefined,
    tenantId: '',
    groupId: null,
    supplierCode: '',
    supplierName: '',
    supplierCategory: '',
    supplierGroup: '',
    supplierType: 'general',
    enterpriseNature: '',
    industry: '',
    contactPerson: '',
    contactPhone: '',
    region: '',
    regionAdcode: '',
    addressDetail: '',
    longitude: null,
    latitude: null,
    coordinateSystem: 'gcj02',
    remark: ''
  })

  const model = reactive<SupplierForm>(initialForm())
  const form = reactive<{
    model: SupplierForm
    items: ComputedRef<FormItem[]>
    rules: FormRules<SupplierForm>
  }>({
    model,
    items: computed(() => [
      { label: '单位信息', key: 'identitySection', type: 'divider', span: 24 },
      {
        label: '所属租户',
        key: 'tenantId',
        type: 'select',
        span: 24,
        options: tenantOptions.value,
        props: { disabled: !!model.id || !isPlatformScope.value, filterable: true }
      },
      {
        label: '单位编码',
        key: 'supplierCode',
        type: 'input',
        props: { maxlength: 40, clearable: true, placeholder: '如 SUP-0001' }
      },
      {
        label: '单位名称',
        key: 'supplierName',
        type: 'input',
        props: { maxlength: 120, clearable: true, placeholder: '请输入供应商完整单位名称' }
      },
      {
        label: '供应商类别',
        key: 'supplierCategory',
        type: 'select',
        options: supplierCategoryOptions,
        props: { clearable: true, placeholder: '请选择供应商类别' }
      },
      {
        label: '供应商分组',
        key: 'groupId',
        type: 'treeSelect',
        options: groups.value
          .filter((row) => row.tenantId === model.tenantId)
          .map((row) => ({ label: row.name, value: row.id, parentId: row.parentId })),
        props: { clearable: true, placeholder: '选择供应商分组' }
      },
      {
        label: '供应商类型',
        key: 'supplierType',
        type: 'select',
        span: 8,
        options: supplierTypeOptions,
        props: { clearable: false, placeholder: '请选择供应商类型' }
      },
      {
        label: '企业性质',
        key: 'enterpriseNature',
        type: 'select',
        span: 8,
        options: enterpriseNatureOptions,
        props: { clearable: true, placeholder: '请选择企业性质' }
      },
      {
        label: '行业',
        key: 'industry',
        type: 'select',
        span: 8,
        options: industryOptions,
        props: { clearable: true, placeholder: '请选择行业' }
      },
      { label: '联系与位置', key: 'contactSection', type: 'divider', span: 24 },
      {
        label: '联系人',
        key: 'contactPerson',
        type: 'input',
        props: { maxlength: 50, clearable: true, placeholder: '请输入主要联系人' }
      },
      {
        label: '联系电话',
        key: 'contactPhone',
        type: 'input',
        props: { maxlength: 30, clearable: true, placeholder: '请输入手机号或座机号' }
      },
      { label: '', key: 'addressPicker', type: 'input', span: 24, labelWidth: 0 },
      { label: '补充信息', key: 'additionalSection', type: 'divider', span: 24 },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: {
          type: 'textarea',
          rows: 3,
          maxlength: 500,
          showWordLimit: true,
          resize: 'none',
          placeholder: '可补充合作范围、资质情况或业务注意事项'
        }
      }
    ]),
    rules: {
      tenantId: [{ required: true, message: '请选择所属租户', trigger: 'change' }],
      supplierCode: [
        { required: true, message: '请输入单位编码', trigger: 'blur' },
        {
          pattern: /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
          message: '仅支持字母、数字、短横线和下划线',
          trigger: 'blur'
        },
        { max: 40, message: '单位编码不能超过 40 个字符', trigger: 'blur' }
      ],
      supplierName: [
        { required: true, message: '请输入单位名称', trigger: 'blur' },
        { max: 120, message: '单位名称不能超过 120 个字符', trigger: 'blur' }
      ],
      supplierCategory: [{ required: true, message: '请选择供应商类别', trigger: 'change' }],
      supplierType: [{ required: true, message: '请选择供应商类型', trigger: 'change' }],
      enterpriseNature: [{ required: true, message: '请选择企业性质', trigger: 'change' }],
      industry: [{ required: true, message: '请选择行业', trigger: 'change' }],
      contactPerson: [{ max: 50, message: '联系人不能超过 50 个字符', trigger: 'blur' }],
      contactPhone: [
        {
          validator: (_rule, value, callback) => {
            if (!value) return callback()
            return /^(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8}|\+?\d[\d -]{5,19})$/.test(String(value))
              ? callback()
              : callback(new Error('请输入正确的手机号或座机号'))
          },
          trigger: 'blur'
        }
      ],
      addressDetail: [
        { required: true, message: '请输入详细地址', trigger: 'blur' },
        { max: 300, message: '详细地址不能超过 300 个字符', trigger: 'blur' }
      ],
      remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
    }
  })

  const resetForm = async (): Promise<void> => {
    Object.assign(form.model, initialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await savePurchaseSupplier({
        ...toRaw(form.model),
        supplierCode: form.model.supplierCode.trim().toUpperCase(),
        supplierName: form.model.supplierName.trim(),
        supplierGroup: form.model.groupId
          ? groups.value.find((row) => row.id === form.model.groupId)?.name || null
          : null,
        contactPerson: normalizeNullableText(form.model.contactPerson),
        contactPhone: normalizeNullableText(form.model.contactPhone),
        region: normalizeNullableText(form.model.region),
        regionAdcode: normalizeNullableText(form.model.regionAdcode),
        addressDetail: normalizeNullableText(form.model.addressDetail),
        longitude: form.model.longitude,
        latitude: form.model.latitude,
        remark: normalizeNullableText(form.model.remark)
      })
      emit('success', form.model.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '供应商档案保存失败，请检查填写内容和网络后重试')
      return false
    }
  }

  const handleOpen = async (data: SupplierDialogOpenData): Promise<void> => {
    await resetForm()
    groups.value = data.groups
    tenantOptions.value = data.tenantOptions
    form.model.tenantId = data.row?.tenantId || data.tenantId
    form.model.groupId = data.initialGroupId || null
    if (data.row) {
      Object.assign(form.model, {
        ...data.row,
        supplierGroup: data.row.supplierGroup || '',
        enterpriseNature: data.row.enterpriseNature || '',
        industry: data.row.industry || '',
        contactPerson: data.row.contactPerson || '',
        contactPhone: data.row.contactPhone || '',
        region: data.row.region || '',
        regionAdcode: data.row.regionAdcode || '',
        addressDetail: data.row.addressDetail || '',
        longitude: data.row.longitude ?? null,
        latitude: data.row.latitude ?? null,
        coordinateSystem: data.row.coordinateSystem || 'gcj02',
        remark: data.row.remark || ''
      })
    }

    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑供应商' : '新增供应商',
      subtitle: '维护跨系统共用的单位身份、分类口径、联系人和地图地址',
      confirmText: data.row ? '保存更改' : '创建供应商',
      contentMaxHeight: '72vh',
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  defineExpose({ handleOpen })
</script>
