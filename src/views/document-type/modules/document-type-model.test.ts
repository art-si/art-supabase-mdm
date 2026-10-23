import assert from 'node:assert/strict'
import test from 'node:test'
import type { DocumentTypeRecord } from '@mdm/api'
import {
  buildDocumentTypeInput,
  createDocumentTypeCopyModel,
  createDocumentTypeFormModel
} from './document-type-model'

const source: DocumentTypeRecord = {
  id: 'source-id',
  tenantId: 'tenant-id',
  menuId: 'menu-id',
  menuIds: ['menu-id'],
  documentTypeCode: 'ORDER',
  documentTypeName: '运输订单',
  isDefault: true,
  remark: '业务主单',
  sortOrder: 20,
  textColor: '#409eff',
  tagStyle: 'primary',
  enabled: true,
  extensionFields: [],
  packingEnabled: false,
  packingThicknessFieldKey: null,
  allowedIssueWarehouseTypes: ['raw_material', 'outsourced'],
  productionReportControl: 'warning',
  productionFullIssueControl: 'strict',
  productionFullIssueScope: 'non_backflush',
  productionWipDeductionTiming: 'none'
}

test('copy model keeps presentation but clears the unique code and default state', () => {
  const copy = createDocumentTypeCopyModel(source)

  assert.equal(copy.sourceId, source.id)
  assert.equal(copy.tenantId, source.tenantId)
  assert.equal(copy.documentTypeCode, '')
  assert.equal(copy.documentTypeName, '运输订单（副本）')
  assert.equal(copy.isDefault, false)
  assert.deepEqual(copy.menuIds, ['menu-id'])
  assert.equal(copy.sortOrder, 30)
  assert.deepEqual(copy.allowedIssueWarehouseTypes, source.allowedIssueWarehouseTypes)
  assert.equal(copy.productionReportControl, 'none')
  assert.equal(copy.productionFullIssueControl, 'none')
  assert.equal(copy.productionFullIssueScope, 'all')
  assert.equal(copy.productionWipDeductionTiming, 'inbound_approval')
})

test('payable type copies keep mapping while payloads exclude joined labels', () => {
  for (const index of [1, 2]) {
    const original: DocumentTypeRecord = {
      ...source,
      documentTypeCode: `CUSTOM_EST_${index}`,
      payableStandardPurchase: false,
      financialPayableTypeId: `financial-${index}`,
      financialPayableType: {
        id: `financial-${index}`,
        documentTypeCode: `CUSTOM_FIN_${index}`,
        documentTypeName: `财务应付类型${index}`,
        enabled: true
      }
    }
    const copy = createDocumentTypeCopyModel(original)
    assert.equal(copy.financialPayableTypeId, original.financialPayableTypeId)
    assert.equal(copy.payableStandardPurchase, false)
    const payload = buildDocumentTypeInput(copy, true)
    assert.equal(payload.financialPayableTypeId, original.financialPayableTypeId)
    assert.equal('financialPayableType' in payload, false)
  }
})

test('builtin standard types cannot initialize as nonstandard direct-push types', () => {
  for (const code of ['AP_EST_STANDARD', 'AP_FIN_STANDARD']) {
    const model = createDocumentTypeFormModel({
      documentTypeCode: code,
      payableStandardPurchase: false,
      financialPayableTypeId: 'forged-target'
    })
    assert.equal(model.payableStandardPurchase, true)
    assert.equal(model.financialPayableTypeId, null)
  }
})

test('write payload normalizes text and only includes tenant when required', () => {
  const model = createDocumentTypeFormModel({
    tenantId: 'tenant-id',
    menuId: 'menu-id',
    menuIds: ['menu-id', 'second-menu-id'],
    documentTypeCode: '  order_return  ',
    documentTypeName: '  退货单  ',
    remark: '  退货业务  ',
    textColor: '#409eff'
  })

  const tenantPayload = buildDocumentTypeInput(model, true)
  assert.deepEqual(tenantPayload.menuIds, ['menu-id', 'second-menu-id'])
  assert.equal(tenantPayload.menuId, 'menu-id')
  const ordinaryPayload = buildDocumentTypeInput(model, false)

  assert.equal(tenantPayload.documentTypeCode, 'ORDER_RETURN')
  assert.equal(tenantPayload.documentTypeName, '退货单')
  assert.equal(tenantPayload.remark, '退货业务')
  assert.equal(tenantPayload.textColor, '#409EFF')
  assert.equal(tenantPayload.tenantId, 'tenant-id')
  assert.equal('tenantId' in ordinaryPayload, false)
  assert.deepEqual(tenantPayload.allowedIssueWarehouseTypes, ['raw_material'])
  assert.equal(tenantPayload.productionReportControl, 'none')
  assert.equal(tenantPayload.productionFullIssueControl, 'none')
  assert.equal(tenantPayload.productionFullIssueScope, 'all')
  assert.equal(tenantPayload.productionWipDeductionTiming, 'inbound_approval')
})
