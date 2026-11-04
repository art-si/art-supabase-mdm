import { mdmCatalogSourceDefinitions } from '@mdm/api'

const sourceTypeLabels = new Map(
  Object.values(mdmCatalogSourceDefinitions)
    .flat()
    .map((source) => [source.type, source.label])
)

const eventTypeLabels: Record<string, string> = {
  'mdm.quality-issue.open': '质量问题已创建',
  'mdm.change-request.published': '主数据变更已发布'
}

const aggregateTypeLabels: Record<string, string> = {
  quality_issue: '质量问题',
  change_request: '主数据变更'
}

export const getGovernanceSourceTypeLabel = (sourceType?: string | null): string =>
  (sourceType && sourceTypeLabels.get(sourceType)) || '未知主档'

export const getGovernanceChangeOperationLabel = (
  operation?: string | null,
  options: readonly { value: string; label: string }[] = []
): string => options.find((item) => item.value === operation)?.label || operation || '其他动作'

export const getGovernanceEventTypeLabel = (eventType?: string | null): string =>
  (eventType && eventTypeLabels[eventType]) || '治理事件'

export const getGovernanceAggregateTypeLabel = (aggregateType?: string | null): string =>
  (aggregateType && aggregateTypeLabels[aggregateType]) || '主数据记录'

export const getGovernanceSourceCodeLabel = (
  sourceType: string,
  sourceRecordId: string,
  sourceCode?: string | null
): string => {
  if (!sourceCode || sourceCode === `${sourceType}:${sourceRecordId}`) return '未配置业务编码'
  return sourceCode
}
