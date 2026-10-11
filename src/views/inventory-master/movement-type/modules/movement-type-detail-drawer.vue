<template>
  <ArtDrawer ref="drawerRef" size="md" :show-footer="false">
    <div class="space-y-4">
      <ArtEntitySummary
        icon="ri:swap-box-line"
        eyebrow="INVENTORY MOVEMENT"
        :title="record.movementName"
        :description="record.movementCode"
      >
        <template #aside>
          <ElTag :type="record.status === 'enabled' ? 'success' : 'info'" effect="light">
            {{ record.status === 'enabled' ? '启用' : '禁用' }}
          </ElTag>
        </template>
      </ArtEntitySummary>
      <ArtSectionCard title="类型定义" subtitle="移动方向、反向关系及控制标志。">
        <ArtDescriptions :data="record" :items="definitionItems" :columns="2" :tablet-columns="2" />
      </ArtSectionCard>
      <ArtSectionCard title="记录信息" subtitle="备注和最近维护时间。">
        <ArtDescriptions :data="record" :items="auditItems" :columns="2" :tablet-columns="2" />
      </ArtSectionCard>
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import { formatWithDayjs } from '@/utils/time'
  import type { MovementTypeRecord } from '@mdm/api'

  const drawerRef = ref<ArtDrawerExpose<MovementTypeRecord>>()
  const record = shallowRef<MovementTypeRecord>({
    id: '',
    tenantId: '',
    movementCode: '',
    movementName: '',
    direction: 'inbound',
    reverseTypeId: null,
    reversal: false,
    otherIo: false,
    status: 'enabled',
    remark: null,
    createTime: '',
    updateTime: ''
  })
  const definitionItems: ArtDescriptionItem<MovementTypeRecord>[] = [
    { key: 'movementCode', label: '移动类型编码', field: 'movementCode', copyable: true },
    { key: 'movementName', label: '移动类型名称', field: 'movementName' },
    {
      key: 'direction',
      label: '出入库类型',
      field: 'direction',
      dictCode: 'mdmStockMovementDirection',
      dictDisplay: 'auto'
    },
    {
      key: 'reverseType',
      label: '反向类型',
      value: (row: MovementTypeRecord) =>
        row.reverseType
          ? `${row.reverseType.movementCode} · ${row.reverseType.movementName}`
          : '未设置'
    },
    {
      key: 'reversal',
      label: '冲销标志',
      value: (row: MovementTypeRecord) => String(row.reversal ?? ''),
      dictCode: 'commonBoolean',
      dictDisplay: 'text'
    },
    {
      key: 'otherIo',
      label: '其他出入库',
      value: (row: MovementTypeRecord) => String(row.otherIo ?? ''),
      dictCode: 'commonBoolean',
      dictDisplay: 'text'
    },
    {
      key: 'status',
      label: '启用状态',
      value: (row: MovementTypeRecord) => (row.status === 'enabled' ? '启用' : '禁用')
    }
  ]
  const auditItems: ArtDescriptionItem<MovementTypeRecord>[] = [
    { key: 'remark', label: '备注', field: 'remark', span: 2 },
    {
      key: 'createTime',
      label: '创建时间',
      value: (row: MovementTypeRecord) => formatWithDayjs(row.createTime)
    },
    {
      key: 'updateTime',
      label: '更新时间',
      value: (row: MovementTypeRecord) => formatWithDayjs(row.updateTime)
    }
  ]

  async function handleOpen(row: MovementTypeRecord): Promise<void> {
    record.value = row
    await drawerRef.value?.handleOpen(row, {
      title: '查看出入库类型',
      subtitle: '核对移动类型的业务定义与维护记录。',
      showFooter: false
    })
  }
  defineExpose({ handleOpen })
</script>
