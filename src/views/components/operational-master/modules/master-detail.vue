<template>
  <div class="operational-master-detail">
    <ElTabs v-if="sections.length > 1" v-model="activeTab">
      <ElTabPane
        v-for="section in sections"
        :key="section.key"
        :name="section.key"
        :label="section.title"
        :lazy="false"
      >
        <ArtDescriptions
          :label-width="132"
          :data="record"
          :items="section.items"
          :columns="2"
          :tablet-columns="2"
          :mobile-columns="1"
          empty-text="—"
        />
      </ElTabPane>
    </ElTabs>
    <ArtDescriptions
      v-else
      :label-width="132"
      :data="record"
      :items="sections[0]?.items || []"
      :columns="2"
      :tablet-columns="2"
      :mobile-columns="1"
      empty-text="—"
    />
  </div>
</template>

<script setup lang="ts">
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type {
    MasterGroup,
    MasterReferenceOption,
    OperationalMasterRecord,
    OperationalMasterReferences
  } from '@mdm/api'
  import type { MasterFieldConfig, OperationalMasterConfig } from './master-config'

  const props = defineProps<{
    config: OperationalMasterConfig
    record: OperationalMasterRecord
    groups: MasterGroup[]
    references: OperationalMasterReferences
    tenantOptions: Array<{ label: string; value: string }>
  }>()

  function referenceLabel(items: MasterReferenceOption[], id: unknown): string {
    if (!id) return '—'
    const ids = Array.isArray(id) ? id : [id]
    return ids.map((value) => items.find((item) => item.id === value)?.name || '未识别').join('、')
  }

  function formatter(
    field: MasterFieldConfig
  ): ArtDescriptionItem<OperationalMasterRecord>['formatter'] {
    if (field.key === 'groupId') {
      return (value) => props.groups.find((item) => item.id === value)?.name || '未分组'
    }
    if (field.reference) {
      return (value) => referenceLabel(props.references[field.reference!], value)
    }
    if (field.key === 'ownerId' || field.key === 'salespersonId') {
      return (value) => referenceLabel(props.references.employees, value)
    }
    if (field.key === 'responsiblePersonId') {
      return (value) => referenceLabel(props.references.personnel, value)
    }
    if (Array.isArray(props.record[field.key])) {
      return (value) => (Array.isArray(value) && value.length ? value.join('、') : '—')
    }
    return undefined
  }

  function toDescriptionItem(
    field: MasterFieldConfig
  ): ArtDescriptionItem<OperationalMasterRecord> {
    return {
      key: String(field.key),
      label: field.label,
      field: String(field.key),
      dictCode: field.dictCode,
      dictDisplay: field.key === 'enabled' ? 'tag' : 'text',
      formatter: field.dictCode ? undefined : formatter(field),
      copyable: field.key === props.config.codeKey,
      span: field.type === 'textarea' || field.key === 'addressDetail' ? 2 : 1
    }
  }

  const auditItems: ArtDescriptionItem<OperationalMasterRecord>[] = [
    {
      key: 'createTime',
      label: '创建时间',
      field: 'createTime',
      format: 'datetime'
    },
    {
      key: 'updateTime',
      label: '更新时间',
      field: 'updateTime',
      format: 'datetime'
    }
  ]
  const sections = computed(() => {
    const assigned = new Set(props.config.formSections.flatMap((section) => section.fieldKeys))
    return props.config.formSections.map((section, index) => {
      const fields = section.fieldKeys.flatMap((key) => {
        const field = props.config.fields.find((field) => field.key === key)
        return field ? [field] : []
      })
      if (index === 0)
        fields.push(...props.config.fields.filter((field) => !assigned.has(field.key)))
      const items = fields.map(toDescriptionItem)
      if (index === 0) {
        items.unshift({
          key: 'tenantId',
          label: '所属租户',
          field: 'tenantId',
          formatter: (value) =>
            props.tenantOptions.find((item) => item.value === value)?.label || '当前租户'
        })
        items.push(...auditItems)
      }
      return { key: section.key, title: section.title, items }
    })
  })
  const activeTab = ref('')
  watch(
    () => [props.config.kind, props.record.id],
    () => {
      activeTab.value = sections.value[0]?.key || ''
    },
    { immediate: true }
  )
</script>

<style scoped lang="scss">
  .operational-master-detail {
    display: grid;
    min-width: 0;
  }
</style>
