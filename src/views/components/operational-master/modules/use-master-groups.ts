import { onScopeDispose, reactive, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { fetchMasterGroups, type MasterGroup, type MasterGroupDomain } from '@/api/master-groups'
import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'

interface MasterGroupState {
  rows: MasterGroup[]
  selectedId: string
  loading: boolean
  error: string
}

export function useMasterGroups(
  domain: MaybeRefOrGetter<MasterGroupDomain | undefined>,
  tenantId: MaybeRefOrGetter<string | null>
) {
  const groupState = reactive<MasterGroupState>({
    rows: [],
    selectedId: '',
    loading: false,
    error: ''
  })
  let requestVersion = 0
  let active = true

  watch(
    [() => toValue(domain), () => toValue(tenantId)],
    () => {
      requestVersion += 1
      Object.assign(groupState, { rows: [], selectedId: '', loading: false, error: '' })
    },
    { flush: 'sync' }
  )
  onScopeDispose(() => {
    active = false
  })

  async function loadGroups(): Promise<void> {
    const groupDomain = toValue(domain)
    if (!active || !groupDomain) return

    const request = ++requestVersion
    const isCurrent = () => active && request === requestVersion
    groupState.loading = true
    groupState.error = ''
    try {
      const rows = await fetchMasterGroups(groupDomain, toValue(tenantId))
      if (isCurrent()) groupState.rows = rows
    } catch (error) {
      if (isCurrent())
        groupState.error = getFriendlySupabaseErrorMessage(error, '分组加载失败，请重试')
    } finally {
      if (isCurrent()) groupState.loading = false
    }
  }

  return { groupState, loadGroups }
}
