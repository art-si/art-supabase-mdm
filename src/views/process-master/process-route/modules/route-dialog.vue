<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <div class="process-route-dialog">
      <ArtEntitySummary
        icon="ri:route-line"
        eyebrow="PROCESS ROUTE DESIGN"
        :title="routeIdentityTitle"
        :description="routeIdentityDescription"
      >
        <template #aside>
          <ArtDictDisplay dict-code="commonBoolean" :value="String(form.enabled)" display="tag" />
        </template>
      </ArtEntitySummary>

      <div class="process-route-dialog__form-panel">
        <ArtForm
          ref="formRef"
          :model-value="form"
          @update:model-value="replaceReactiveModel(form, $event)"
          :items="items"
          :rules="rules"
          :span="12"
          :gutter="24"
          label-position="top"
          :show-reset="false"
          :show-submit="false"
        >
          <template #materialId>
            <ArtMaterialSelect
              v-if="isCreating"
              v-model:model-values="materialIds"
              multiple
              :selected-data="selection"
              :api-fn="fetchMaterials"
              :categories="materialCategories"
              subtitle="按物料分类筛选；每个物料会创建一条独立路线，并继承各自的生产单位"
              empty-description="请先维护物料编码后再创建工艺路线。"
              @change="handleMaterialChange"
            />
            <ArtMaterialSelect
              v-else
              v-model="form.materialId"
              :selected-data="selection"
              :api-fn="fetchMaterials"
              :categories="materialCategories"
              subtitle="从当前租户物料编码中选择路线适用对象"
              empty-description="请先维护物料编码后再创建工艺路线。"
              @change="handleMaterialChange"
            />
            <p v-if="isCreating && selection.length" class="process-route-dialog__material-hint">
              <ArtSvgIcon icon="ri:information-line" />
              {{ materialSelectionHint }}
            </p>
          </template>
        </ArtForm>
      </div>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { toNameCodeOption } from '@/utils/form/option'

  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import dayjs from 'dayjs'
  import { cloneDeep, uniq } from 'lodash-es'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtMaterialSelect from '@/components/business/art-material-select/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import type {
    DataSelectFetchParams,
    DataSelectKey,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    saveProcessRoute,
    saveProcessRoutes,
    fetchMaterialCategories,
    fetchProcessRoutePath,
    fetchProcessRouteMaterialOptions,
    fetchProductionDepartmentTree,
    fetchProcessRouteReferences,
    type ProcessRoute,
    type ProcessRouteInput,
    type ProcessRouteMaterialOption,
    type ProcessRouteReferences,
    type ProductionDepartmentTreeNode,
    type MaterialCategory
  } from '@mdm/api'
  import { buildProcessRoutePayload } from './process-route-payload'

  const emit = defineEmits<{ success: [] }>()
  const user = useUserStore()
  const { getDictMap } = storeToRefs(user)
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const selection = ref<ProcessRouteMaterialOption[]>([])
  const materialIds = ref<string[]>([])
  const isCreating = ref(true)
  const productionUnitOverridden = ref(false)
  const departmentTree = ref<ProductionDepartmentTreeNode[]>([])
  const materialCategories = ref<MaterialCategory[]>([])
  const references = ref<ProcessRouteReferences>({
    groups: [],
    operations: [],
    controlCodes: [],
    units: [],
    departments: [],
    workCenters: [],
    activityFormulas: [],
    suppliers: [],
    esopDocuments: []
  })
  const initialForm = (): ProcessRouteInput => ({
    tenantId: '',
    materialId: '',
    code: '',
    name: '',
    routeType: 'standard',
    allocationMode: 'quantity',
    groupId: null,
    version: '',
    batchFrom: null,
    batchTo: 9999999999,
    productionUnitId: null,
    departmentId: null,
    effectiveDate: dayjs().format('YYYY-MM-DD'),
    expiryDate: '9999-12-31',
    isDefault: false,
    source: 'manual',
    customUnitConversion: false,
    enabled: true,
    path: '',
    remark: ''
  })
  const form = reactive<ProcessRouteInput>(initialForm())
  const booleanOptions = computed(() =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      label: item.label || item.value,
      value: item.value === 'true' || item.value === '1'
    }))
  )
  const routeIdentityTitle = computed(
    () => form.name.trim() || selection.value[0]?.materialName || '新工艺路线'
  )
  const routeIdentityDescription = computed(() => {
    if (form.code.trim()) return `路线编码：${form.code.trim()}`
    const materialName = selection.value[0]?.materialName
    return materialName
      ? `适用物料：${materialName}`
      : '定义产品版本、批量范围与生效规则；保存后可继续维护工序序列。'
  })
  const materialSelectionHint = computed(() => {
    const unitIds = uniq(selection.value.map((item) => item.productionUnitId).filter(Boolean))
    if (unitIds.length <= 1)
      return `已选择 ${selection.value.length} 个物料，生产单位已自动带入；仍可手工统一修改。`
    return `已选择 ${selection.value.length} 个物料，生产单位不一致；不修改时将分别继承各物料单位。`
  })

  const items = computed<FormItem[]>(() => [
    { key: 'identity', label: '路线识别', type: 'divider', span: 24 },
    {
      key: 'code',
      label: '路线编码',
      props: { disabled: true, placeholder: '保存时自动生成 4 位流水码' }
    },
    {
      key: 'name',
      label: '路线名称',
      props: { maxlength: 120, placeholder: '选填，用于区分同一物料的多条路线' }
    },
    { key: 'materialId', label: '数据来源物料编码', type: 'slot' },
    {
      key: 'groupId',
      label: '路线分组',
      type: 'select',
      options: references.value.groups.map(toNameCodeOption),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'routeType',
      label: '路线类型',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteType ?? []
    },
    {
      key: 'allocationMode',
      label: '分配方式',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteAllocationMode ?? []
    },
    { key: 'version', label: '工艺版本', props: { maxlength: 40 } },
    {
      key: 'departmentId',
      label: '生产车间',
      type: 'treeSelect',
      props: {
        data: departmentTree.value,
        clearable: true,
        filterable: true,
        checkStrictly: true,
        defaultExpandAll: true,
        nodeKey: 'id',
        props: { label: 'name', value: 'id', children: 'children' },
        placeholder: '按层级选择生产车间'
      }
    },
    { key: 'scope', label: '批量与有效期', type: 'divider', span: 24 },
    {
      key: 'batchFrom',
      label: '批量从',
      type: 'number',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'batchTo',
      label: '批量至',
      type: 'number',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'productionUnitId',
      label: '生产单位',
      type: 'select',
      options: references.value.units.map(toNameCodeOption),
      props: { clearable: true, filterable: true, onChange: handleProductionUnitChange }
    },
    {
      key: 'effectiveDate',
      label: '生效日期',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      key: 'expiryDate',
      label: '失效日期',
      type: 'date',
      props: { valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      key: 'strategy',
      label: '策略与状态',
      type: 'divider',
      span: 24
    },
    {
      key: 'source',
      label: '来源',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteSource ?? []
    },
    {
      key: 'isDefault',
      label: '默认路线',
      type: 'segment',
      options: booleanOptions.value
    },
    {
      key: 'customUnitConversion',
      label: '自定义单位换算',
      type: 'segment',
      options: booleanOptions.value
    },
    {
      key: 'enabled',
      label: '启用状态',
      type: 'segment',
      options: booleanOptions.value
    },
    {
      key: 'path',
      label: '工艺路径',
      type: 'text',
      span: 24,
      description: '按工序顺序自动组合，只读展示；请在“工艺维护”中调整工序。',
      props: { emptyText: '尚未配置工序' }
    },
    {
      key: 'remark',
      label: '备注',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000, showWordLimit: true, resize: 'none' }
    }
  ])
  const rules = {
    materialId: [{ required: true, message: '请选择数据来源物料编码', trigger: 'change' }],
    batchTo: [
      {
        validator: (_rule: unknown, value: number, callback: (error?: Error) => void) =>
          value >= (form.batchFrom ?? 0) ? callback() : callback(new Error('批量至不能小于批量从')),
        trigger: 'blur'
      }
    ],
    effectiveDate: [{ required: true, message: '请选择生效日期', trigger: 'change' }],
    expiryDate: [
      {
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) =>
          !value || !form.effectiveDate || value >= form.effectiveDate
            ? callback()
            : callback(new Error('失效日期不能早于生效日期')),
        trigger: 'change'
      }
    ]
  }
  const fetchMaterials = (p: DataSelectFetchParams) =>
    fetchProcessRouteMaterialOptions({
      tenantId: form.tenantId,
      keyword: p.keyword,
      categoryId: String(p.filters.categoryId || '') || undefined,
      current: p.page,
      size: p.pageSize
    })
  const handleProductionUnitChange = () => {
    productionUnitOverridden.value = true
  }
  const handleMaterialChange = (
    _value: DataSelectKey | DataSelectKey[] | undefined,
    rows: DataSelectRecord[]
  ) => {
    selection.value = rows as ProcessRouteMaterialOption[]
    materialIds.value = selection.value.map((item) => item.id)
    form.materialId = selection.value[0]?.id || ''
    if (productionUnitOverridden.value) return
    const unitIds = uniq(selection.value.map((item) => item.productionUnitId).filter(Boolean))
    form.productionUnitId = unitIds.length === 1 ? unitIds[0]! : null
  }

  async function handleOpen(row?: ProcessRoute, tenantId?: string, copy = false) {
    Object.assign(form, row ? cloneDeep(row) : initialForm())
    isCreating.value = !row || copy
    productionUnitOverridden.value = false
    form.tenantId = row?.tenantId || tenantId || user.info.tenantId || ''
    if (copy)
      Object.assign(form, {
        code: '',
        name: row?.name ? `${row.name} - 副本` : '',
        path: '',
        isDefault: false
      })
    selection.value = row?.material ? [row.material] : []
    materialIds.value = selection.value.map((item) => item.id)
    await dialogRef.value?.handleOpen(undefined, {
      title: copy ? '复制工艺路线' : row ? '编辑工艺路线' : '新增工艺路线',
      subtitle: row
        ? `${row.code} · ${row.name || row.material?.materialName || '未命名路线'}`
        : '定义产品版本、批量范围与生效规则',
      confirmText: copy || !row ? '创建路线' : '保存更改',
      contentMaxHeight: '72vh',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await Promise.all(
            [
              'mdmProcessRouteType',
              'mdmProcessRouteAllocationMode',
              'mdmProcessRouteSource',
              'mdmMaterialSource',
              'mdmMaterialSpecialPurchaseType',
              'commonBoolean'
            ].map((code) => user.ensureDictLoaded(code))
          )
          const targetTenantId = row?.tenantId || tenantId || form.tenantId
          const [nextReferences, nextDepartmentTree, nextMaterialCategories, currentPath] =
            await Promise.all([
              fetchProcessRouteReferences(targetTenantId),
              fetchProductionDepartmentTree(targetTenantId),
              fetchMaterialCategories(targetTenantId),
              row && !copy ? fetchProcessRoutePath(row.id, targetTenantId) : Promise.resolve('')
            ])
          references.value = nextReferences
          departmentTree.value = nextDepartmentTree
          materialCategories.value = nextMaterialCategories
          form.path = currentPath
          formRef.value?.clearValidate()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: async () => {
        try {
          if (!(await validateArtFormForSubmit(formRef.value))) return false
          if (isCreating.value) {
            const targets = selection.value.map((material) =>
              buildProcessRoutePayload({
                ...form,
                materialId: material.id,
                productionUnitId: productionUnitOverridden.value
                  ? form.productionUnitId
                  : material.productionUnitId || null
              })
            )
            await saveProcessRoutes(targets)
          } else {
            await saveProcessRoute(buildProcessRoutePayload(form), row?.id)
          }
          emit('success')
          return true
        } catch (error) {
          notifyFriendlyError(error, '工艺路线保存失败，请检查填写内容和网络后重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .process-route-dialog {
    display: grid;
    gap: var(--art-space-4);

    &__form-panel {
      min-width: 0;
      padding-bottom: var(--art-space-2);
      background: color-mix(
        in srgb,
        var(--el-fill-color-extra-light) 45%,
        var(--default-box-color)
      );
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-control-radius);
    }

    &__material-hint {
      display: flex;
      gap: var(--art-space-2);
      align-items: flex-start;
      margin: var(--art-space-2) 0 0;
      font-size: var(--art-font-size-caption);
      line-height: 20px;
      color: var(--el-text-color-secondary);

      .art-svg-icon {
        flex: none;
        margin-top: 2px;
        color: var(--theme-color);
      }
    }

    @media (width <= 720px) {
      gap: var(--art-space-3);

      &__form-panel {
        padding-bottom: var(--art-space-1);
      }
    }
  }
</style>
