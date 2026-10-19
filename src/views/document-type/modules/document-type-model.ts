import { pick, uniq } from 'lodash-es'
import { normalizeNonNullableText } from '@/utils/form/normalize'
import type { DocumentTypeRecord, DocumentTypeUpdateInput, DocumentTypeWriteInput } from '@mdm/api'

export interface DocumentTypeFormModel extends DocumentTypeWriteInput {
  id?: string
  sourceId?: string
}

export const createDocumentTypeFormModel = (
  patch: Partial<DocumentTypeFormModel> = {}
): DocumentTypeFormModel => ({
  id: undefined,
  sourceId: undefined,
  tenantId: undefined,
  menuId: '',
  menuIds: [],
  documentTypeCode: '',
  documentTypeName: '',
  isDefault: false,
  remark: '',
  sortOrder: 10,
  textColor: '',
  tagStyle: 'primary',
  enabled: true,
  extensionFields: [],
  packingEnabled: false,
  packingThicknessFieldKey: null,
  allowedIssueWarehouseTypes: ['raw_material'],
  productionReportControl: 'none',
  ...patch
})

export const createDocumentTypeCopyModel = (source: DocumentTypeRecord): DocumentTypeFormModel =>
  createDocumentTypeFormModel({
    sourceId: source.id,
    tenantId: source.tenantId,
    menuId: source.menuId,
    menuIds: [...(source.menuIds?.length ? source.menuIds : [source.menuId])],
    documentTypeCode: '',
    documentTypeName: `${source.documentTypeName}（副本）`,
    isDefault: false,
    remark: source.remark,
    sortOrder: source.sortOrder + 10,
    textColor: source.textColor,
    tagStyle: source.tagStyle,
    enabled: source.enabled,
    extensionFields: source.extensionFields.map((field) => ({ ...field })),
    packingEnabled: false,
    packingThicknessFieldKey: null,
    allowedIssueWarehouseTypes: [...source.allowedIssueWarehouseTypes],
    productionReportControl: 'none'
  })

export const buildDocumentTypeInput = (
  model: DocumentTypeFormModel,
  includeTenant: boolean
): DocumentTypeWriteInput => {
  const payload = pick(model, [
    'tenantId',
    'menuId',
    'menuIds',
    'documentTypeCode',
    'documentTypeName',
    'isDefault',
    'remark',
    'sortOrder',
    'textColor',
    'tagStyle',
    'enabled',
    'extensionFields',
    'packingEnabled',
    'packingThicknessFieldKey',
    'allowedIssueWarehouseTypes',
    'productionReportControl'
  ]) as DocumentTypeWriteInput

  payload.documentTypeCode = normalizeNonNullableText(payload.documentTypeCode).toUpperCase()
  payload.menuIds = uniq(payload.menuIds)
  payload.menuId = payload.menuIds[0] ?? ''
  payload.documentTypeName = normalizeNonNullableText(payload.documentTypeName)
  payload.remark = normalizeNonNullableText(payload.remark)
  payload.textColor = normalizeNonNullableText(payload.textColor).toUpperCase()
  payload.tagStyle = normalizeNonNullableText(
    payload.tagStyle
  ) as DocumentTypeWriteInput['tagStyle']
  payload.extensionFields = payload.extensionFields.map((field) => ({
    key: field.key.trim(),
    label: field.label.trim(),
    valueType: field.valueType,
    sourceComponentTypeId:
      field.valueType === 'material' ? field.sourceComponentTypeId || null : null
  }))
  payload.packingThicknessFieldKey = payload.packingEnabled
    ? normalizeNonNullableText(payload.packingThicknessFieldKey ?? '')
    : null
  if (!includeTenant) delete payload.tenantId
  return payload
}

export const buildDocumentTypeUpdateInput = (
  model: DocumentTypeFormModel
): DocumentTypeUpdateInput => {
  const payload = buildDocumentTypeInput(model, false)
  delete payload.tenantId
  return payload
}
