<template>
  <ArtDialog ref="dialogRef" size="lg">
    <ArtForm
      ref="formRef"
      v-model="model"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="20"
      label-position="top"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { saveSupplierContact, type SupplierContact, type SupplierContactInput } from '@mdm/api'

  interface OpenData {
    supplierId: string
    row?: SupplierContact
  }
  interface FormModel {
    supplierId: string
    name: string
    alias: string
    gender: string
    position: string
    department: string
    phone: string
    fax: string
    wechat: string
    qq: string
    email: string
    remark: string
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const genderOptions = useDictionaryOptions('sex')
  const editingId = ref('')
  const initial = (): FormModel => ({
    supplierId: '',
    name: '',
    alias: '',
    gender: '',
    position: '',
    department: '',
    phone: '',
    fax: '',
    wechat: '',
    qq: '',
    email: '',
    remark: ''
  })
  const model = ref<FormModel>(initial())
  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '联系人身份', type: 'tab', span: 24 },
    { key: 'name', label: '姓名', type: 'input', props: { maxlength: 60 } },
    { key: 'alias', label: '别名', type: 'input', props: { maxlength: 60 } },
    {
      key: 'gender',
      label: '性别',
      type: 'select',
      props: {
        clearable: true,
        options: genderOptions
      }
    },
    { key: 'position', label: '职务', type: 'input', props: { maxlength: 80 } },
    { key: 'department', label: '部门', type: 'input', props: { maxlength: 80 } },
    { key: 'contact', label: '联系方式', type: 'tab', span: 24 },
    { key: 'phone', label: '联系电话', type: 'input', props: { maxlength: 40 } },
    { key: 'fax', label: '传真', type: 'input', props: { maxlength: 40 } },
    { key: 'wechat', label: '微信', type: 'input', props: { maxlength: 80 } },
    { key: 'qq', label: 'QQ', type: 'input', props: { maxlength: 40 } },
    { key: 'email', label: '邮箱', type: 'input', props: { maxlength: 160 } },
    {
      key: 'remark',
      label: '备注',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])
  const rules = {
    name: [{ required: true, message: '请输入联系人姓名', trigger: 'blur' }],
    email: [{ type: 'email' as const, message: '请输入有效邮箱', trigger: 'blur' }]
  }

  async function handleOpen(data: OpenData): Promise<void> {
    Object.assign(model.value, initial(), data.row || {}, { supplierId: data.supplierId })
    editingId.value = data.row?.id || ''
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑联系人' : '新增联系人',
      subtitle: '联系方式将作为供应商主数据统一维护',
      confirmText: data.row ? '保存更改' : '添加联系人',
      onOpen: () => {
        formRef.value?.clearValidate()
      },
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          const payload: SupplierContactInput = {
            supplierId: model.value.supplierId,
            name: model.value.name.trim(),
            alias: normalizeNullableText(model.value.alias),
            gender: normalizeNullableText(model.value.gender),
            position: normalizeNullableText(model.value.position),
            department: normalizeNullableText(model.value.department),
            phone: normalizeNullableText(model.value.phone),
            fax: normalizeNullableText(model.value.fax),
            wechat: normalizeNullableText(model.value.wechat),
            qq: normalizeNullableText(model.value.qq),
            email: normalizeNullableText(model.value.email),
            remark: normalizeNullableText(model.value.remark)
          }
          await saveSupplierContact(payload, editingId.value || undefined)
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '供应商联系人保存失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
