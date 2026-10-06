import { omit } from 'lodash-es'
import { useSupabase } from '@/hooks'
import { buildOrIlikeFilter } from '@/utils/supabase/search'

export interface PurchaseSupplier {
  id: string
  tenantId: string
  supplierCode: string
  supplierName: string
  supplierCategory: string
  supplierType: string
  supplierGroup: string | null
  groupId: string | null
  enterpriseNature: string | null
  industry: string | null
  contactPerson: string | null
  contactPhone: string | null
  region: string | null
  regionAdcode: string | null
  addressDetail: string | null
  longitude: number | null
  latitude: number | null
  coordinateSystem: string
  remark: string | null
  updateTime: string
}

export type PurchaseSupplierInput = Omit<PurchaseSupplier, 'id' | 'updateTime'> & { id?: string }

export interface SupplierQuery {
  current: number
  size: number
  keyword?: string
  supplierCategory?: string
  supplierType?: string
  groupIds?: string[]
  ids?: string[]
  tenantId?: string | null
}

export interface SupplierBank {
  id: string
  tenantId: string
  supplierId: string
  bankAccount: string
  accountName: string
  iban: string | null
  bankName: string
  currencyCode: string
  payeeAddress: string | null
  payeePhone: string | null
}

export type SupplierBankInput = Omit<SupplierBank, 'id' | 'tenantId'>

export interface SupplierContact {
  id: string
  tenantId: string
  supplierId: string
  name: string
  alias: string | null
  gender: string | null
  position: string | null
  department: string | null
  phone: string | null
  fax: string | null
  wechat: string | null
  qq: string | null
  email: string | null
  remark: string | null
}

export type SupplierContactInput = Omit<SupplierContact, 'id' | 'tenantId'>

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

const readOptions = {
  breakReturn: true,
  showErrorMessage: true,
  errorMessage: '供应商资料加载失败，请重试'
}

export async function fetchPurchaseSuppliers(query: SupplierQuery, signal?: AbortSignal) {
  let request = supabase
    .from('mdm_supplier')
    .select('*', { count: 'exact' })
    .order('update_time', { ascending: false })
    .range((query.current - 1) * query.size, query.current * query.size - 1)
  if (query.tenantId) request = request.eq('tenant_id', query.tenantId)
  if (query.groupIds?.length) request = request.in('group_id', query.groupIds)
  if (query.ids?.length) request = request.in('id', query.ids)
  if (query.supplierCategory) request = request.eq('supplier_category', query.supplierCategory)
  if (query.supplierType) request = request.eq('supplier_type', query.supplierType)
  if (query.keyword?.trim()) {
    request = request.or(
      buildOrIlikeFilter(
        ['supplier_code', 'supplier_name', 'contact_person', 'contact_phone', 'address_detail'],
        query.keyword.trim()
      )
    )
  }
  const { data, total } = await responseHandle<PurchaseSupplier[]>(
    () => (signal ? request.abortSignal(signal) : request),
    readOptions
  )
  return { records: data ?? [], total: total ?? 0 }
}

export async function savePurchaseSupplier(input: PurchaseSupplierInput) {
  const { data } = await responseHandle<string>(
    () =>
      supabase.rpc('smis_save_supplier_secure', {
        p_id: input.id ?? null,
        p_payload: keysToSnakeDeep(omit(input, ['id']))
      }),
    {
      breakReturn: true,
      showErrorMessage: true,
      showMessage: true,
      message: input.id ? '供应商已更新' : '供应商已新增',
      errorMessage: '供应商保存失败，请检查编码、分组和权限'
    }
  )
  return data
}

export async function fetchSupplierBanks(supplierId: string) {
  const { data } = await responseHandle<SupplierBank[]>(
    () =>
      supabase
        .from('mdm_supplier_bank')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('create_time'),
    { ...readOptions, errorMessage: '银行信息加载失败，请重试' }
  )
  return data ?? []
}

export async function saveSupplierBank(input: SupplierBankInput, id?: string) {
  const payload = keysToSnakeDeep(input)
  await responseHandle(
    () =>
      id
        ? supabase.from('mdm_supplier_bank').update(payload).eq('id', id).select('id')
        : supabase.from('mdm_supplier_bank').insert(payload).select('id'),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: true,
      showMessage: true,
      message: '银行信息已保存',
      errorMessage: '银行信息保存失败，请检查当前权限'
    }
  )
}

export async function deleteSupplierBank(id: string) {
  await responseHandle(
    () => supabase.from('mdm_supplier_bank').delete().eq('id', id).select('id'),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: true,
      showMessage: true,
      message: '银行信息已删除',
      errorMessage: '银行信息删除失败，请重试'
    }
  )
}

export async function fetchSupplierContacts(supplierId: string) {
  const { data } = await responseHandle<SupplierContact[]>(
    () =>
      supabase
        .from('mdm_supplier_contact')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('create_time'),
    { ...readOptions, errorMessage: '联系人加载失败，请重试' }
  )
  return data ?? []
}

export async function saveSupplierContact(input: SupplierContactInput, id?: string) {
  const payload = keysToSnakeDeep(input)
  await responseHandle(
    () =>
      id
        ? supabase.from('mdm_supplier_contact').update(payload).eq('id', id).select('id')
        : supabase.from('mdm_supplier_contact').insert(payload).select('id'),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: true,
      showMessage: true,
      message: '联系人已保存',
      errorMessage: '联系人保存失败，请检查当前权限'
    }
  )
}

export async function deleteSupplierContact(id: string) {
  await responseHandle(
    () => supabase.from('mdm_supplier_contact').delete().eq('id', id).select('id'),
    {
      breakReturn: true,
      showErrorMessage: true,
      requireAffected: true,
      showMessage: true,
      message: '联系人已删除',
      errorMessage: '联系人删除失败，请重试'
    }
  )
}
