import type { SupplyChainCodeSegment } from '@mdm/api'

const sampleValues: Record<string, string> = {
  BUSINESS_DATE: '260911',
  CREATE_DATE: '260911',
  CURRENT_DATE: '260911',
  MATERIAL_CODE: 'MAT001',
  SUPPLIER_CODE: 'SUP01',
  SALES_PERSON: 'SALES01',
  PROJECT_CODE: 'PRJ001',
  CUSTOMER_CODE: 'CUS01',
  BUSINESS_DEPT: 'DEPT01',
  LINE_NO: '1',
  SEQUENCE: '1'
}

function applyLength(value: string, segment: SupplyChainCodeSegment): string {
  if (!segment.length) return value
  if (value.length > segment.length) {
    return segment.truncate ? value.slice(0, segment.length) : value
  }
  if (value.length === segment.length) return value
  return segment.padDirection === 'right'
    ? value.padEnd(segment.length, segment.paddingChar || '0')
    : value.padStart(segment.length, segment.paddingChar || '0')
}

export function buildSupplyChainCodePreview(
  segments: SupplyChainCodeSegment[],
  separator = ''
): string {
  return segments
    .toSorted((left, right) => left.sort - right.sort)
    .map((segment) => {
      const value =
        segment.attributeCode === 'CONSTANT'
          ? segment.configuredValue || 'FIX'
          : sampleValues[segment.attributeCode] || segment.attribute?.attributeName || 'VALUE'
      return applyLength(value, segment)
    })
    .join(separator)
}
