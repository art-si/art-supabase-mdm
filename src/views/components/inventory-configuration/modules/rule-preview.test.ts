import assert from 'node:assert/strict'
import test from 'node:test'
import type { SupplyChainCodeSegment } from '@mdm/api'
import { buildSupplyChainCodePreview } from './rule-preview'

const segment = (
  attributeCode: string,
  sort: number,
  patch: Partial<SupplyChainCodeSegment> = {}
): SupplyChainCodeSegment => ({
  attributeCode,
  useMode: 'full',
  format: '',
  configuredValue: '',
  length: null,
  step: 1,
  paddingChar: '0',
  padDirection: 'left',
  truncate: false,
  sequenceSource: false,
  sort,
  ...patch
})

test('编码示例按属性顺序和分隔符组合', () => {
  assert.equal(
    buildSupplyChainCodePreview(
      [
        segment('SEQUENCE', 30, { length: 6 }),
        segment('CONSTANT', 10, { configuredValue: 'CP-XL' }),
        segment('BUSINESS_DATE', 20)
      ],
      ''
    ),
    'CP-XL260911000001'
  )
})

test('截断和右补位规则生效', () => {
  assert.equal(
    buildSupplyChainCodePreview([
      segment('CONSTANT', 10, {
        configuredValue: 'ABCDEF',
        length: 4,
        truncate: true
      }),
      segment('LINE_NO', 20, { length: 3, padDirection: 'right', paddingChar: 'X' })
    ]),
    'ABCD1XX'
  )
})
