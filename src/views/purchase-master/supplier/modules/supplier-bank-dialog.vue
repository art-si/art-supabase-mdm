<template>
  <ArtDialog ref="dialogRef" size="lg">
    <ArtForm
      ref="formRef"
      :model-value="model"
      @update:model-value="replaceReactiveModel(model, $event)"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="20"
      label-position="top"
      :show-reset="false"
      :show-submit="false"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { normalizeNullableText } from '@/utils/form/normalize'
  import { useUserStore } from '@/store/modules/user'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { saveSupplierBank, type SupplierBank, type SupplierBankInput } from '@mdm/api'

  interface OpenData {
    supplierId: string
    row?: SupplierBank
  }
  interface FormModel {
    supplierId: string
    bankAccount: string
    accountName: string
    iban: string
    bankName: string
    currencyCode: string
    payeeAddress: string
    payeePhone: string
  }
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const editingId = ref('')
  const initial = (): FormModel => ({
    supplierId: '',
    bankAccount: '',
    accountName: '',
    iban: '',
    bankName: '',
    currencyCode: 'CNY',
    payeeAddress: '',
    payeePhone: ''
  })
  const model = reactive<FormModel>(initial())
  const items = computed<FormItem[]>(() => [
    { key: 'account', label: '账户信息', type: 'divider', span: 24 },
    {
      key: 'bankAccount',
      label: '银行账号',
      type: 'input',
      props: { maxlength: 64, placeholder: '请输入银行账号' }
    },
    {
      key: 'accountName',
      label: '账户名称',
      type: 'input',
      props: { maxlength: 120, placeholder: '请输入收款账户名称' }
    },
    {
      key: 'iban',
      label: '国际银行账户号码',
      type: 'input',
      span: 24,
      props: { maxlength: 40, placeholder: '选填 IBAN' }
    },
    {
      key: 'bankName',
      label: '开户银行',
      type: 'input',
      props: { maxlength: 120, placeholder: '请输入开户银行' }
    },
    {
      key: 'currencyCode',
      label: '币种',
      type: 'select',
      props: {
        filterable: true,
        options: (getDictMap.value.mdmCurrency ?? []).map((item) => ({
          label: String(item.label || item.value),
          value: String(item.value)
        }))
      }
    },
    { key: 'payee', label: '收款方联系信息', type: 'divider', span: 24 },
    {
      key: 'payeeAddress',
      label: '收款方详细地址',
      type: 'input',
      span: 24,
      props: { maxlength: 300, placeholder: '请输入详细地址' }
    },
    {
      key: 'payeePhone',
      label: '收款方联系电话',
      type: 'input',
      props: { maxlength: 40, placeholder: '请输入联系电话' }
    }
  ])
  const rules = {
    bankAccount: [{ required: true, message: '请输入银行账号', trigger: 'blur' }],
    accountName: [{ required: true, message: '请输入账户名称', trigger: 'blur' }],
    bankName: [{ required: true, message: '请输入开户银行', trigger: 'blur' }],
    currencyCode: [{ required: true, message: '请选择币种', trigger: 'change' }]
  }

  async function handleOpen(data: OpenData): Promise<void> {
    Object.assign(model, initial(), data.row || {}, { supplierId: data.supplierId })
    editingId.value = data.row?.id || ''
    await dialogRef.value?.handleOpen(data, {
      title: data.row ? '编辑银行信息' : '新增银行信息',
      subtitle: '为当前供应商维护收款账户和收款方信息',
      confirmText: data.row ? '保存更改' : '添加账户',
      onOpen: async () => {
        await userStore.ensureDictLoaded('mdmCurrency')
        formRef.value?.clearValidate()
      },
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          const payload: SupplierBankInput = {
            supplierId: model.supplierId,
            bankAccount: model.bankAccount.trim(),
            accountName: model.accountName.trim(),
            iban: normalizeNullableText(model.iban),
            bankName: model.bankName.trim(),
            currencyCode: model.currencyCode,
            payeeAddress: normalizeNullableText(model.payeeAddress),
            payeePhone: normalizeNullableText(model.payeePhone)
          }
          await saveSupplierBank(payload, editingId.value || undefined)
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '供应商银行账户保存失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
