import assert from 'node:assert/strict'
import test from 'node:test'
import type { ProcessRouteInput, ProcessSequenceInput, ProcessStepInput } from '@mdm/api'
import {
  buildProcessRoutePayload,
  buildProcessSequencePayload,
  buildProcessStepPayload
} from './process-route-payload'

const createInput = (): ProcessRouteInput => ({
  tenantId: ' 7529f951-938e-4e2c-ac0d-316c136ae1f9 ',
  materialId: ' a3a1150a-f2aa-4a19-b4d4-085821fe4770 ',
  code: ' pr0001 ',
  name: ' 路线 11 ',
  routeType: 'standard',
  allocationMode: 'quantity',
  groupId: '',
  version: ' V1 ',
  batchFrom: null,
  batchTo: 9999999999,
  productionUnitId: ' 126ecf66-42a9-45b3-a219-9e5c2de11a26 ',
  departmentId: '',
  effectiveDate: ' 2026-09-12 ',
  expiryDate: ' 9999-12-31 ',
  isDefault: false,
  source: 'manual',
  customUnitConversion: false,
  enabled: true,
  path: ' 下料 > 装配 ',
  remark: ' 测试路线 '
})

test('normalizes cleared optional UUID fields before saving a process route', () => {
  const payload = buildProcessRoutePayload(createInput())

  assert.equal(payload.groupId, null)
  assert.equal(payload.departmentId, null)
  assert.equal(payload.productionUnitId, '126ecf66-42a9-45b3-a219-9e5c2de11a26')
})

test('trims route values and normalizes a cleared production unit', () => {
  const input = createInput()
  input.groupId = ' fcf99fc4-ca23-4e34-a459-d07719d27100 '
  input.productionUnitId = ''

  const payload = buildProcessRoutePayload(input)

  assert.equal(payload.tenantId, '7529f951-938e-4e2c-ac0d-316c136ae1f9')
  assert.equal(payload.materialId, 'a3a1150a-f2aa-4a19-b4d4-085821fe4770')
  assert.equal(payload.code, 'PR0001')
  assert.equal(payload.name, '路线 11')
  assert.equal(payload.groupId, 'fcf99fc4-ca23-4e34-a459-d07719d27100')
  assert.equal(payload.productionUnitId, null)
  assert.equal(payload.effectiveDate, '2026-09-12')
  assert.equal(payload.expiryDate, '9999-12-31')
  assert.equal(payload.path, '下料 > 装配')
  assert.equal(payload.remark, '测试路线')
})

test('keeps joined display records and audit fields out of route update payloads', () => {
  const input = Object.assign(createInput(), {
    id: 'b6dc5512-2cea-422b-949f-c5842989f62b',
    createBy: 'operator@example.com',
    createTime: '2026-09-06T13:02:27Z',
    updateTime: '2026-09-09T07:58:28Z',
    material: { id: 'a3a1150a-f2aa-4a19-b4d4-085821fe4770' },
    group: null,
    productionUnit: null,
    department: null
  })

  const payload = buildProcessRoutePayload(input)

  for (const key of [
    'id',
    'createBy',
    'createTime',
    'updateTime',
    'material',
    'group',
    'productionUnit',
    'department'
  ]) {
    assert.equal(Object.hasOwn(payload, key), false)
  }
})

test('normalizes optional UUIDs and strips extra fields from sequence and step writes', () => {
  const sequence = Object.assign(
    {
      routeId: ' b6dc5512-2cea-422b-949f-c5842989f62b ',
      sequenceNo: 1,
      sequenceType: 'main',
      transferInStepId: '',
      transferOutStepId: null,
      remark: ' 标准序列 '
    } satisfies ProcessSequenceInput,
    { id: 'sequence-id', tenantId: 'tenant-id' }
  )
  const step = Object.assign(
    {
      routeId: ' b6dc5512-2cea-422b-949f-c5842989f62b ',
      sequenceId: ' sequence-id ',
      code: ' 10 ',
      name: ' 装配 ',
      operationId: '',
      description: ' 安装部件 ',
      unitId: null,
      basicBatch: 1,
      workCenterId: '',
      workCenterIds: [],
      departmentId: '',
      runOutputQuantity: 1,
      runProcessingMinutes: 1,
      runGreenMinutes: null,
      setupMinutes: 0,
      operatorCount: 1,
      machineCount: 1,
      queueMinutes: 0,
      transferMinutes: 0,
      minimumTransferQuantity: 1,
      overlapEnabled: false,
      operationMode: 'individual',
      controlCodeId: null,
      processingMode: '',
      reportMode: '',
      inspectionMode: '',
      sequenceControl: '',
      reworkMode: '',
      needInspection: false,
      firstInspection: false,
      firstInspectionControl: 'none',
      isFirst: true,
      isLast: false,
      critical: false,
      unitConversion: {},
      activities: [],
      outsourcing: {},
      inspection: {},
      sopDocuments: [],
      sort: 10
    } satisfies ProcessStepInput,
    { id: 'step-id', operation: { id: 'operation-id' }, department: null }
  )

  const sequencePayload = buildProcessSequencePayload(sequence)
  const stepPayload = buildProcessStepPayload(step)

  assert.equal(sequencePayload.transferInStepId, null)
  assert.equal(sequencePayload.remark, '标准序列')
  assert.equal(Object.hasOwn(sequencePayload, 'id'), false)
  assert.equal(stepPayload.operationId, null)
  assert.equal(stepPayload.workCenterId, null)
  assert.deepEqual(stepPayload.workCenterIds, [])
  assert.equal(stepPayload.departmentId, null)
  assert.equal(stepPayload.runGreenMinutes, 0)
  assert.equal(stepPayload.name, '装配')
  assert.equal(Object.hasOwn(stepPayload, 'operation'), false)
  assert.equal(Object.hasOwn(stepPayload, 'department'), false)
})
