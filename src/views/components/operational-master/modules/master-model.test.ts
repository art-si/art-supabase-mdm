import assert from 'node:assert/strict'
import test from 'node:test'
import { createOperationalMasterModel } from './master-model'

test('new master records use field semantics and only initialize configured fields', () => {
  const model = createOperationalMasterModel({
    tenantId: 'platform',
    config: {
      kind: 'operation',
      fields: [
        { key: 'code', label: '编码' },
        { key: 'price', label: '价格' },
        { key: 'workCenterIds', label: '工作中心', multiple: true },
        { key: 'participatesScheduling', label: '排程' },
        { key: 'customerId', label: '客户' }
      ]
    },
    initialGroupId: 'group'
  })
  assert.equal(model.tenantId, 'platform')
  assert.equal(model.code, '')
  assert.equal(model.price, 0)
  assert.equal(model.participatesScheduling, false)
  assert.equal(model.customerId, null)
  assert.equal(model.groupId, 'group')
  assert.deepEqual(model.workCenterIds, [])
  assert.equal('projectCode' in model, false)
})

test('copy resets generated identity while preserving source tenant and isolating nested values', () => {
  const row = {
    id: 'source',
    tenantId: 'source-tenant',
    enabled: false,
    projectCode: 'PR001',
    projectName: '项目',
    activityTypes: ['setup'],
    formulaTranslation: '旧公式'
  }
  const config = {
    kind: 'project' as const,
    fields: [
      { key: 'projectCode' as const, label: '编码', systemGenerated: true },
      { key: 'formulaTranslation' as const, label: '公式', systemGenerated: true },
      { key: 'activityTypes' as const, label: '类型', multiple: true }
    ]
  }
  const copy = createOperationalMasterModel({ config, tenantId: 'selected', row, copy: true })
  assert.equal(copy.id, '')
  assert.equal(copy.tenantId, 'source-tenant')
  assert.equal(copy.enabled, false)
  assert.equal(copy.projectCode, '')
  assert.equal(copy.formulaTranslation, null)
  assert.equal(copy.projectName, '项目')
  copy.activityTypes?.push('run')
  assert.deepEqual(row.activityTypes, ['setup'])
  assert.equal(row.projectCode, 'PR001')
  const edit = createOperationalMasterModel({ config, tenantId: 'selected', row })
  assert.equal(edit.id, 'source')
  assert.equal(edit.projectCode, 'PR001')
})

test('new form instances do not share mutable field defaults', () => {
  const context = {
    tenantId: 'tenant',
    config: {
      kind: 'operation' as const,
      fields: [{ key: 'workCenterIds' as const, label: '工作中心', multiple: true }]
    }
  }
  const first = createOperationalMasterModel(context)
  first.workCenterIds?.push('center')
  assert.deepEqual(createOperationalMasterModel(context).workCenterIds, [])
})
