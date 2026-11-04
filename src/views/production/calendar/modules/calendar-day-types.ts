import type { ProductionCalendarDayType } from '@mdm/api'

export const calendarDayTypeMetadata: Array<{
  value: ProductionCalendarDayType
  description: string
  color: string
  icon: string
}> = [
  {
    value: 'rest_day',
    description: '全日休息',
    color: 'var(--el-color-warning)',
    icon: 'ri:cup-line'
  },
  {
    value: 'statutory_holiday',
    description: '法定或企业假日',
    color: 'var(--el-color-success)',
    icon: 'ri:plane-line'
  },
  {
    value: 'work_day',
    description: '正常生产',
    color: 'var(--theme-color)',
    icon: 'ri:briefcase-4-line'
  },
  {
    value: 'half_work_day',
    description: '半天生产',
    color: 'var(--el-color-primary)',
    icon: 'ri:time-line'
  }
]

export const calendarDayTypesWithLabels = (options: readonly { value: string; label: string }[]) =>
  calendarDayTypeMetadata.flatMap((meta) => {
    const label = options.find((item) => item.value === meta.value)?.label
    return label ? [{ ...meta, label }] : []
  })
