export const storageToneOptions = [
  { value: 'available', label: '可存', color: 'var(--el-color-success)' },
  { value: 'occupied', label: '有库存', color: 'var(--el-color-primary)' },
  { value: 'abnormal', label: '异常', color: 'var(--el-color-danger)' },
  { value: 'disabled', label: '停用', color: 'var(--el-color-info)' }
] as const
