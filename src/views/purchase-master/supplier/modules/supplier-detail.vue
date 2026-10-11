<template>
  <ArtDrawer
    :loading="loading"
    ref="drawerRef"
    size="xl"
    :show-footer="false"
    show-fullscreen-button
  >
    <div v-if="record" class="supplier-detail grid min-w-0 gap-4">
      <ArtEntitySummary
        icon="ri:store-2-line"
        eyebrow="SUPPLIER MASTER DATA"
        :title="record.supplierName"
        :description="`${record.supplierCode} · ${groupName}`"
      />

      <ElTabs v-model="activeTab" class="min-w-0">
        <ElTabPane label="基本信息" name="overview" class="grid min-w-0 gap-3.5">
          <ArtSectionCard title="单位信息" subtitle="统一身份与业务分类" preserve-content-structure>
            <ArtDescriptions
              :data="record"
              :items="overviewItems"
              :columns="2"
              :tablet-columns="2"
              :mobile-columns="1"
              empty-text="—"
            />
          </ArtSectionCard>
          <ArtSectionCard
            title="联系与位置"
            subtitle="供安全、车辆等业务实时引用"
            preserve-content-structure
          >
            <ArtDescriptions
              :data="record"
              :items="contactItems"
              :columns="2"
              :tablet-columns="2"
              :mobile-columns="1"
              empty-text="—"
            />
          </ArtSectionCard>
        </ElTabPane>

        <ElTabPane label="银行信息" name="banks" class="grid min-w-0 gap-3.5">
          <ArtSectionCard
            title="银行信息"
            :subtitle="`共 ${banks.length} 个收款账户`"
            :error="error"
            :empty="!banks.length"
            empty-title="暂无银行信息"
            empty-description="可添加收款账户、币种与收款方联系信息。"
            retryable
            preserve-content-structure
            @retry="loadRelated"
          >
            <template #actions>
              <ElButton
                v-auth="'MdmPurchaseSupplier:ManageBank'"
                type="primary"
                @click="openBank()"
              >
                <template #icon><ArtSvgIcon icon="ri:add-line" /></template>
                新增银行信息
              </ElButton>
            </template>
            <ArtTable
              :data="banks"
              :columns="bankColumns"
              row-key="id"
              :pagination="false"
              table-layout="fixed"
              :scrollbar-always-on="false"
              :max-height="480"
              empty-text="暂无银行信息"
            />
          </ArtSectionCard>
        </ElTabPane>

        <ElTabPane label="联系人" name="contacts" class="grid min-w-0 gap-3.5">
          <ArtSectionCard
            title="联系人"
            :subtitle="`共 ${contacts.length} 位联系人`"
            :error="error"
            :empty="!contacts.length"
            empty-title="暂无联系人"
            empty-description="可添加姓名、职务和多种联系方式。"
            retryable
            preserve-content-structure
            @retry="loadRelated"
          >
            <template #actions>
              <ElButton
                v-auth="'MdmPurchaseSupplier:ManageContact'"
                type="primary"
                @click="openContact()"
              >
                <template #icon><ArtSvgIcon icon="ri:add-line" /></template>
                新增联系人
              </ElButton>
            </template>
            <ArtTable
              :data="contacts"
              :columns="contactColumns"
              row-key="id"
              :pagination="false"
              table-layout="fixed"
              :scrollbar-always-on="false"
              :max-height="480"
              empty-text="暂无联系人"
            />
          </ArtSectionCard>
        </ElTabPane>
      </ElTabs>
    </div>
    <SupplierBankDialog ref="bankDialogRef" @success="handleRelatedSaved" />
    <SupplierContactDialog ref="contactDialogRef" @success="handleRelatedSaved" />
  </ArtDrawer>
</template>

<script setup lang="tsx">
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    deleteSupplierBank,
    deleteSupplierContact,
    fetchSupplierBanks,
    fetchSupplierContacts,
    type MasterGroup,
    type PurchaseSupplier,
    type SupplierBank,
    type SupplierContact
  } from '@mdm/api'
  import SupplierBankDialog from './supplier-bank-dialog.vue'
  import SupplierContactDialog from './supplier-contact-dialog.vue'

  const props = defineProps<{ groups: MasterGroup[] }>()
  const emit = defineEmits<{ changed: [] }>()
  const { confirmDelete } = useArtFeedback()
  const drawerRef = ref<ArtDrawerExpose<PurchaseSupplier>>()
  const bankDialogRef = ref<{
    handleOpen: (data: { supplierId: string; row?: SupplierBank }) => Promise<void>
  }>()
  const contactDialogRef = ref<{
    handleOpen: (data: { supplierId: string; row?: SupplierContact }) => Promise<void>
  }>()
  const record = ref<PurchaseSupplier>()
  const banks = ref<SupplierBank[]>([])
  const contacts = ref<SupplierContact[]>([])
  const loading = ref(false)
  const error = ref('')
  const activeTab = ref('overview')
  let loadVersion = 0

  const groupName = computed(
    () => props.groups.find((group) => group.id === record.value?.groupId)?.name || '未分组'
  )

  const overviewItems = computed<ArtDescriptionItem<PurchaseSupplier>[]>(() => [
    { key: 'supplierCode', label: '供应商编码', field: 'supplierCode' },
    { key: 'supplierName', label: '供应商名称', field: 'supplierName' },
    { key: 'groupId', label: '供应商分组', formatter: () => groupName.value },
    {
      key: 'supplierCategory',
      label: '供应商类别',
      field: 'supplierCategory',
      dictCode: 'supplierCategory',
      dictDisplay: 'text'
    },
    {
      key: 'supplierType',
      label: '供应商类型',
      field: 'supplierType',
      dictCode: 'supplierType',
      dictDisplay: 'text'
    },
    {
      key: 'enterpriseNature',
      label: '企业性质',
      field: 'enterpriseNature',
      dictCode: 'enterpriseNature',
      dictDisplay: 'text'
    },
    {
      key: 'industry',
      label: '行业',
      field: 'industry',
      dictCode: 'supplierIndustry',
      dictDisplay: 'text'
    },
    { key: 'remark', label: '备注', field: 'remark', span: 2 }
  ])
  const contactItems: ArtDescriptionItem<PurchaseSupplier>[] = [
    { key: 'contactPerson', label: '主要联系人', field: 'contactPerson' },
    { key: 'contactPhone', label: '联系电话', field: 'contactPhone' },
    { key: 'addressDetail', label: '详细地址', field: 'addressDetail', span: 2 }
  ]
  const bankColumns: ColumnOption<SupplierBank>[] = [
    { type: 'globalIndex', label: '序号', width: 65 },
    { prop: 'bankAccount', label: '银行账号', minWidth: 175, showOverflowTooltip: true },
    { prop: 'accountName', label: '账户名称', minWidth: 170, showOverflowTooltip: true },
    { prop: 'iban', label: '国际银行账户号码', minWidth: 190, showOverflowTooltip: true },
    { prop: 'bankName', label: '开户银行', minWidth: 170, showOverflowTooltip: true },
    { prop: 'currencyCode', label: '币种', width: 90 },
    { prop: 'payeeAddress', label: '收款方详细地址', minWidth: 205, showOverflowTooltip: true },
    { prop: 'payeePhone', label: '收款方联系电话', minWidth: 155, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 96,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="edit"
            permission="MdmPurchaseSupplier:ManageBank"
            onClick={() => openBank(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="MdmPurchaseSupplier:ManageBank"
            onClick={() => void removeBank(row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const contactColumns: ColumnOption<SupplierContact>[] = [
    { type: 'globalIndex', label: '序号', width: 65 },
    { prop: 'name', label: '姓名', minWidth: 105, showOverflowTooltip: true },
    { prop: 'alias', label: '别名', minWidth: 105, showOverflowTooltip: true },
    {
      prop: 'supplierId',
      label: '供应商',
      minWidth: 175,
      formatter: () => record.value?.supplierName || '—'
    },
    {
      prop: 'gender',
      label: '性别',
      width: 75,
      dict: { code: 'sex', display: 'text' }
    },
    { prop: 'position', label: '职务', minWidth: 115, showOverflowTooltip: true },
    { prop: 'department', label: '部门', minWidth: 115, showOverflowTooltip: true },
    { prop: 'phone', label: '联系电话', minWidth: 145, showOverflowTooltip: true },
    { prop: 'fax', label: '传真', minWidth: 130, showOverflowTooltip: true },
    { prop: 'wechat', label: '微信', minWidth: 120, showOverflowTooltip: true },
    { prop: 'qq', label: 'QQ', minWidth: 115, showOverflowTooltip: true },
    { prop: 'email', label: '邮箱', minWidth: 180, showOverflowTooltip: true },
    { prop: 'remark', label: '备注', minWidth: 190, showOverflowTooltip: true },
    {
      prop: 'operation',
      label: '操作',
      width: 96,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="edit"
            permission="MdmPurchaseSupplier:ManageContact"
            onClick={() => openContact(row)}
          />
          <ArtButtonTable
            type="delete"
            permission="MdmPurchaseSupplier:ManageContact"
            onClick={() => void removeContact(row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]

  async function loadRelated(): Promise<void> {
    if (!record.value) return
    const version = ++loadVersion
    loading.value = true
    error.value = ''
    try {
      const [bankRows, contactRows] = await Promise.all([
        fetchSupplierBanks(record.value.id),
        fetchSupplierContacts(record.value.id)
      ])
      if (version !== loadVersion) return
      banks.value = bankRows
      contacts.value = contactRows
    } catch {
      if (version === loadVersion) error.value = '关联资料加载失败，请重试'
    } finally {
      if (version === loadVersion) loading.value = false
    }
  }
  function openBank(row?: SupplierBank): void {
    if (!record.value) return
    void bankDialogRef.value?.handleOpen({ supplierId: record.value.id, row })
  }
  function openContact(row?: SupplierContact): void {
    if (!record.value) return
    void contactDialogRef.value?.handleOpen({ supplierId: record.value.id, row })
  }
  async function removeBank(row: SupplierBank): Promise<void> {
    await confirmDelete(`确定删除账户“${row.accountName}”吗？`)
    await deleteSupplierBank(row.id)
    await loadRelated()
    emit('changed')
  }
  async function removeContact(row: SupplierContact): Promise<void> {
    await confirmDelete(`确定删除联系人“${row.name}”吗？`)
    await deleteSupplierContact(row.id)
    await loadRelated()
    emit('changed')
  }
  function handleRelatedSaved(): void {
    void loadRelated()
    emit('changed')
  }
  async function handleOpen(row: PurchaseSupplier): Promise<void> {
    record.value = row
    banks.value = []
    contacts.value = []
    activeTab.value = 'overview'
    await drawerRef.value?.handleOpen(row, {
      title: row.supplierName,
      subtitle: `${row.supplierCode} · 供应商主档`,
      size: 'xl'
    })
    await loadRelated()
  }
  defineExpose({ handleOpen })
</script>
