import type { ProcessRouteInput, ProcessSequenceInput, ProcessStepInput } from '@mdm/api'
import { uniq } from 'lodash-es'
import { normalizeNullableText } from '@/utils/form/normalize'

export function buildProcessRoutePayload(input: ProcessRouteInput): ProcessRouteInput {
  return {
    tenantId: input.tenantId.trim(),
    materialId: input.materialId.trim(),
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    routeType: input.routeType,
    allocationMode: input.allocationMode,
    groupId: normalizeNullableText(input.groupId),
    version: input.version.trim(),
    batchFrom: input.batchFrom,
    batchTo: input.batchTo,
    productionUnitId: normalizeNullableText(input.productionUnitId),
    departmentId: normalizeNullableText(input.departmentId),
    effectiveDate: input.effectiveDate.trim(),
    expiryDate: input.expiryDate.trim(),
    isDefault: input.isDefault,
    source: input.source,
    customUnitConversion: input.customUnitConversion,
    enabled: input.enabled,
    path: input.path.trim(),
    remark: input.remark.trim()
  }
}

export function buildProcessSequencePayload(input: ProcessSequenceInput): ProcessSequenceInput {
  return {
    routeId: input.routeId.trim(),
    sequenceNo: input.sequenceNo,
    sequenceType: input.sequenceType,
    transferInStepId: normalizeNullableText(input.transferInStepId),
    transferOutStepId: normalizeNullableText(input.transferOutStepId),
    remark: input.remark.trim()
  }
}

export function buildProcessStepPayload(input: ProcessStepInput): ProcessStepInput {
  const workCenterIds = uniq(input.workCenterIds.filter(Boolean))
  return {
    routeId: input.routeId.trim(),
    sequenceId: normalizeNullableText(input.sequenceId),
    code: input.code.trim(),
    name: input.name.trim(),
    operationId: normalizeNullableText(input.operationId),
    description: input.description.trim(),
    unitId: normalizeNullableText(input.unitId),
    basicBatch: input.basicBatch,
    workCenterId: workCenterIds[0] ?? null,
    workCenterIds,
    departmentId: normalizeNullableText(input.departmentId),
    runOutputQuantity: input.runOutputQuantity,
    runProcessingMinutes: input.runProcessingMinutes,
    runGreenMinutes: input.runGreenMinutes ?? 0,
    setupMinutes: input.setupMinutes,
    operatorCount: input.operatorCount,
    machineCount: input.machineCount,
    queueMinutes: input.queueMinutes,
    transferMinutes: input.transferMinutes,
    minimumTransferQuantity: input.minimumTransferQuantity,
    overlapEnabled: input.overlapEnabled,
    operationMode: input.operationMode,
    controlCodeId: normalizeNullableText(input.controlCodeId),
    processingMode: input.processingMode,
    reportMode: input.reportMode,
    inspectionMode: input.inspectionMode,
    sequenceControl: input.sequenceControl,
    reworkMode: input.reworkMode,
    needInspection: input.needInspection,
    firstInspection: input.firstInspection,
    firstInspectionControl: input.firstInspectionControl,
    isFirst: input.isFirst,
    isLast: input.isLast,
    critical: input.critical,
    unitConversion: input.unitConversion,
    activities: input.activities,
    outsourcing: input.outsourcing,
    inspection: input.inspection,
    sopDocuments: input.sopDocuments,
    sort: input.sort
  }
}
