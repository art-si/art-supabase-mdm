<template>
  <ArtDrawer ref="drawerRef">
    <div class="document-type-detail">
      <ArtEntitySummary
        icon="ri:file-list-3-line"
        eyebrow="DOCUMENT TYPE"
        :title="detail.record.documentTypeName"
        :description="`${detail.record.documentTypeCode} · ${detail.menuPath || '未关联菜单'}`"
      >
        <template #aside>
          <ElTag
            :type="detail.record.tagStyle || 'primary'"
            effect="light"
            round
            :style="tagPreviewStyle"
          >
            {{ detail.record.documentTypeName }}
          </ElTag>
        </template>
      </ArtEntitySummary>

      <ArtSectionCard title="类型定义" subtitle="单据类型的业务归属与稳定标识。">
        <ArtDescriptions :data="detail" :items="definitionItems" :columns="2">
          <template #item-isDefault>
            <ArtDictDisplay
              dict-code="commonBoolean"
              :value="String(detail.record.isDefault)"
              display="tag"
            />
          </template>
          <template #item-enabled>
            <ArtDictDisplay
              dict-code="commonBoolean"
              :value="String(detail.record.enabled)"
              display="tag"
            />
          </template>
          <template #item-packingEnabled>
            <ArtDictDisplay
              dict-code="commonBoolean"
              :value="String(detail.record.packingEnabled)"
            />
          </template>
        </ArtDescriptions>
      </ArtSectionCard>

      <ArtSectionCard
        v-if="detail.isPayableType"
        title="应付业务规则"
        subtitle="应付单按保存时的规则快照执行，不随类型配置变更而重写历史。"
      >
        <ArtDescriptions :data="detail" :items="payableItems" :columns="2">
          <template #item-payableStandardPurchase>
            <ArtDictDisplay
              dict-code="commonBoolean"
              :value="String(detail.record.payableStandardPurchase ?? false)"
            />
          </template>
        </ArtDescriptions>
      </ArtSectionCard>

      <ArtSectionCard
        v-if="detail.isProductionType"
        title="完工入库控制"
        subtitle="按工单类型复核报工、BOM 领料与在制材料扣减时机。"
      >
        <ArtDescriptions :data="detail" :items="reportControlItems" :columns="2">
          <template #item-productionReportControl>
            <ArtDictDisplay
              dict-code="mdmProductionReportControl"
              :value="detail.record.productionReportControl || 'none'"
            />
          </template>
          <template #item-productionFullIssueControl>
            <ArtDictDisplay
              dict-code="mdmProductionReportControl"
              :value="detail.record.productionFullIssueControl || 'none'"
            />
          </template>
          <template #item-productionFullIssueScope>
            <ArtDictDisplay
              dict-code="mdmProductionFullIssueScope"
              :value="detail.record.productionFullIssueScope || 'all'"
            />
          </template>
          <template #item-productionWipDeductionTiming>
            <ArtDictDisplay
              dict-code="mdmProductionWipDeductionTiming"
              :value="detail.record.productionWipDeductionTiming || 'inbound_approval'"
            />
          </template>
        </ArtDescriptions>
      </ArtSectionCard>

      <ArtSectionCard
        v-if="detail.isProductionType"
        title="领料仓库范围"
        subtitle="工单下达锁料和关联工单出库均按此范围执行。"
      >
        <div class="flex flex-wrap gap-2">
          <ArtDictDisplay
            v-for="warehouseType in detail.record.allowedIssueWarehouseTypes"
            :key="warehouseType"
            dict-code="mdmWarehouseType"
            :value="warehouseType"
            display="tag"
          />
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        v-if="
          detail.isProductionType &&
          detail.record.packingEnabled &&
          detail.record.extensionFields?.length
        "
        title="排包工单专用字段"
        subtitle="选择此类型的生产工单时显示，并可从 BOM 组件类型取值。"
      >
        <div class="document-type-detail__fields">
          <div v-for="field in detail.record.extensionFields" :key="field.key">
            <strong>{{ field.label }}</strong>
            <small
              >{{ field.key }} ·
              {{ field.sourceComponentTypeId ? 'BOM 自动带入' : '手动填写' }}</small
            >
          </div>
        </div>
      </ArtSectionCard>

      <ArtSectionCard title="显示与审计" subtitle="列表展示风格以及最近一次维护信息。">
        <ArtDescriptions :data="detail" :items="auditItems" :columns="2">
          <template #item-tagStyle>
            <ElTag
              :type="detail.record.tagStyle || 'primary'"
              effect="light"
              :style="tagPreviewStyle"
            >
              样式预览
            </ElTag>
          </template>
          <template #item-textColor>
            <span class="document-type-detail__color">
              <i :style="{ backgroundColor: detail.record.textColor || 'currentColor' }" />
              {{ detail.record.textColor || '跟随标签样式' }}
            </span>
          </template>
        </ArtDescriptions>
      </ArtSectionCard>
    </div>
  </ArtDrawer>
</template>

<script setup lang="ts">
  import type { CSSProperties } from 'vue'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import { formatWithDayjs } from '@/utils/time'
  import type { DocumentTypeRecord } from '@mdm/api'

  export interface DocumentTypeDetailData {
    record: DocumentTypeRecord
    menuPath: string
    isProductionType: boolean
    isPayableType?: boolean
  }

  const drawerRef = ref<ArtDrawerExpose<DocumentTypeDetailData>>()
  const detail = reactive<DocumentTypeDetailData>({
    record: {
      id: '',
      tenantId: '',
      menuId: '',
      menuIds: [],
      documentTypeCode: '',
      documentTypeName: '',
      isDefault: false,
      remark: '',
      sortOrder: 10,
      textColor: '',
      tagStyle: 'primary',
      enabled: true,
      extensionFields: [],
      packingEnabled: false,
      packingThicknessFieldKey: null,
      allowedIssueWarehouseTypes: ['raw_material'],
      productionReportControl: 'none',
      productionFullIssueControl: 'none',
      productionFullIssueScope: 'all',
      productionWipDeductionTiming: 'inbound_approval'
    },
    menuPath: '',
    isProductionType: false,
    isPayableType: false
  })

  const tagPreviewStyle = computed<CSSProperties>(() => ({
    color: detail.record.textColor || undefined
  }))
  const payableItems: ArtDescriptionItem<DocumentTypeDetailData>[] = [
    {
      key: 'payableStandardPurchase',
      label: '标准采购业务',
      field: 'record.payableStandardPurchase'
    },
    {
      key: 'financialPayableType',
      label: '下推财务应付类型',
      value: (data: DocumentTypeDetailData) =>
        data.record.payableStandardPurchase
          ? '从同源采购入库单到票'
          : data.record.financialPayableType?.documentTypeName || '未配置'
    }
  ]
  const definitionItems = computed<ArtDescriptionItem<DocumentTypeDetailData>[]>(() => [
    { key: 'menuPath', label: '所属菜单功能', field: 'menuPath', span: 2 },
    {
      key: 'documentTypeCode',
      label: '单据类型编号',
      field: 'record.documentTypeCode',
      copyable: true
    },
    { key: 'documentTypeName', label: '单据类型名称', field: 'record.documentTypeName' },
    { key: 'isDefault', label: '默认单据类型', field: 'record.isDefault' },
    { key: 'enabled', label: '状态', field: 'record.enabled' },
    ...(detail.isProductionType
      ? [
          { key: 'packingEnabled', label: '需要排包', field: 'record.packingEnabled' },
          {
            key: 'packingThicknessFieldKey',
            label: '板厚参数字段',
            value: (data: DocumentTypeDetailData) => data.record.packingThicknessFieldKey || '—'
          }
        ]
      : []),
    { key: 'sortOrder', label: '排序', field: 'record.sortOrder' },
    {
      key: 'tenantName',
      label: '所属租户',
      value: (data: DocumentTypeDetailData) => data.record.tenant?.tenantName
    },
    { key: 'remark', label: '备注', field: 'record.remark', span: 2 }
  ])
  const reportControlItems: ArtDescriptionItem<DocumentTypeDetailData>[] = [
    {
      key: 'productionReportControl',
      label: '报工控制',
      field: 'record.productionReportControl'
    },
    {
      key: 'productionFullIssueControl',
      label: '完全领料控制',
      field: 'record.productionFullIssueControl'
    },
    {
      key: 'productionFullIssueScope',
      label: '组件范围',
      field: 'record.productionFullIssueScope'
    },
    {
      key: 'productionWipDeductionTiming',
      label: '在制材料扣减时机',
      field: 'record.productionWipDeductionTiming'
    }
  ]
  const auditItems: ArtDescriptionItem<DocumentTypeDetailData>[] = [
    { key: 'tagStyle', label: '标签样式', field: 'record.tagStyle' },
    { key: 'textColor', label: '文字颜色', field: 'record.textColor' },
    { key: 'createBy', label: '创建人', field: 'record.createBy' },
    {
      key: 'createTime',
      label: '创建时间',
      value: (data: DocumentTypeDetailData) => formatWithDayjs(data.record.createTime) || '--'
    },
    { key: 'updateBy', label: '更新人', field: 'record.updateBy' },
    {
      key: 'updateTime',
      label: '更新时间',
      value: (data: DocumentTypeDetailData) => formatWithDayjs(data.record.updateTime) || '--'
    }
  ]

  const handleOpen = async (data: DocumentTypeDetailData): Promise<void> => {
    Object.assign(detail, data)
    await drawerRef.value?.handleOpen(data, {
      title: '查看单据类型',
      subtitle: '核对业务归属、默认状态与展示配置。',
      size: 'md',
      showFooter: false,
      contentMaxHeight: 'calc(100vh - 118px)'
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .document-type-detail {
    display: grid;
    gap: var(--art-space-4);

    &__color {
      display: inline-flex;
      gap: var(--art-space-2);
      align-items: center;

      i {
        width: 12px;
        height: 12px;
        border: 1px solid var(--art-card-border);
        border-radius: 50%;
      }
    }

    &__fields {
      display: grid;
      gap: var(--art-space-2);
    }

    &__fields > div {
      display: flex;
      gap: var(--art-space-2);
      justify-content: space-between;
      padding: var(--art-space-2);
      border-bottom: 1px solid var(--el-border-color-lighter);
    }

    &__fields small {
      color: var(--el-text-color-secondary);
    }
  }
</style>
