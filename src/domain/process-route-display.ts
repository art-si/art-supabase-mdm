import { useUserStore } from '@/store/modules/user'

/** The persisted main sequence is presented as 标准序列 throughout manufacturing. */
export function getProcessRouteSequenceLabel(value?: string | null, emptyText = '—'): string {
  return useUserStore().getDictDisplayLabelByValue(
    'mdmProcessRouteSequenceType',
    value,
    value === 'main' ? '标准序列' : value || emptyText
  )
}
