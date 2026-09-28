<template>
  <ArtDialog
    ref="dialogRef"
    class="process-route-maintenance-dialog"
    size="xl"
    show-fullscreen-button
    @fullscreen-change="maintenanceFullscreen = $event"
  >
    <div class="route-maintenance" :class="{ 'is-fullscreen': maintenanceFullscreen }">
      <ArtEntitySummary
        icon="ri:route-line"
        eyebrow="PROCESS ROUTE"
        :title="route?.material?.materialName || '未关联产品'"
        :description="routeSummaryDescription"
      >
        <template #aside>
          <dl class="route-maintenance__readiness" aria-label="工艺路线配置概览">
            <div>
              <dt>工序序列</dt>
              <dd>{{ sequenceState.rows.length }}</dd>
            </div>
            <div>
              <dt>{{ search.keyword ? '匹配工序' : '当前序列工序' }}</dt>
              <dd>{{ stepRows.length }}</dd>
            </div>
          </dl>
          <ElTag :type="readonly ? 'info' : stepRows.length ? 'success' : 'warning'" effect="plain">
            {{ readonly ? '只读查看' : stepRows.length ? '已配置工序' : '待配置工序' }}
          </ElTag>
        </template>
      </ArtEntitySummary>

      <div class="route-maintenance__workspace">
        <ArtSectionCard
          :show-scrollbar="false"
          class="route-maintenance__sequences"
          title="工序序列"
          :subtitle="`${sequenceState.rows.length} 条路径 · 标准主线与并行分支`"
          :loading="sequenceState.loading"
          :empty="!sequenceState.loading && !sequenceState.rows.length"
          empty-title="暂无工序序列"
          empty-description="先创建一条标准序列，再添加路线中的工序节点。"
          body-class="route-maintenance__sequence-body"
          :min-height="320"
        >
          <template v-if="!readonly" #actions>
            <ArtIconButton
              v-auth="'MdmProcessRoute:Edit'"
              icon="ri:add-line"
              :label="sequenceCreateActionLabel"
              :disabled="sequenceState.rows.length > 0 && !canCreateParallelSequence"
              @click="openSequence()"
            />
          </template>
          <template v-if="!readonly" #empty-action>
            <ElButton v-auth="'MdmProcessRoute:Edit'" type="primary" @click="openSequence()">
              创建标准序列
            </ElButton>
          </template>
          <ElScrollbar class="route-maintenance__sequence-scroll">
            <ul class="route-maintenance__sequence-tree" aria-label="工序序列层次">
              <li
                v-for="item in sequenceState.rows"
                :key="item.id"
                class="route-maintenance__sequence-branch"
              >
                <div
                  class="route-maintenance__sequence"
                  :class="{ 'is-current': sequenceState.selectedId === item.id }"
                >
                  <button
                    type="button"
                    class="route-maintenance__sequence-select"
                    :aria-current="sequenceState.selectedId === item.id ? 'true' : undefined"
                    @click="selectSequence(item.id)"
                  >
                    <span class="route-maintenance__sequence-index">{{ item.sequenceNo }}</span>
                    <span class="route-maintenance__sequence-copy">
                      <strong>{{ sequenceTypeLabel(item.sequenceType) }}</strong>
                      <small>{{ sequenceNodeDescription(item) }}</small>
                    </span>
                  </button>
                  <span v-if="!readonly" class="route-maintenance__sequence-actions">
                    <ArtIconButton
                      v-auth="'MdmProcessRoute:Edit'"
                      icon="ri:edit-line"
                      label="编辑序列"
                      @click.stop="openSequence(item)"
                    />
                    <ArtIconButton
                      v-if="item.sequenceType !== 'main'"
                      v-auth="'MdmProcessRoute:Edit'"
                      icon="ri:delete-bin-6-line"
                      label="删除序列"
                      tone="danger"
                      @click.stop="removeSequence(item)"
                    />
                  </span>
                </div>

                <ul
                  v-if="getSequenceSteps(item.id).length"
                  class="route-maintenance__sequence-children"
                  :aria-label="`${sequenceTypeLabel(item.sequenceType)}包含的工序`"
                >
                  <li v-for="step in getSequenceSteps(item.id)" :key="step.id">
                    <button
                      type="button"
                      class="route-maintenance__sequence-step"
                      :title="`${step.code} ${step.name}${step.operation?.code ? `｜${step.operation.code}` : ''}`"
                      @click="selectSequence(item.id)"
                    >
                      <span class="route-maintenance__sequence-step-code">{{ step.code }}</span>
                      <span class="route-maintenance__sequence-step-name">{{ step.name }}</span>
                      <span
                        v-if="step.operation?.code"
                        class="route-maintenance__sequence-step-operation"
                      >
                        {{ step.operation.code }}
                      </span>
                    </button>
                  </li>
                </ul>
                <p v-else class="route-maintenance__sequence-empty">暂无工序</p>
              </li>
            </ul>
          </ElScrollbar>
        </ArtSectionCard>

        <ArtTableQuery
          ref="tableRef"
          v-model="search"
          class="route-maintenance__steps"
          :api-fn="fetchRows"
          :columns-factory="columns"
          :header-actions="actions"
          :search-items="stepSearchItems"
          :search-bar-props="{ span: 12, labelWidth: 48, showExpand: false }"
          :enable-cache="false"
          :table-props="{
            rowKey: 'id',
            tableLayout: 'fixed',
            emptyText: sequenceState.selectedId ? '当前序列还没有工序' : '请先选择工序序列',
            emptyDescription: stepEmptyDescription
          }"
        >
          <template #table-header-top>
            <div class="route-maintenance__sequence-context">
              <span class="route-maintenance__sequence-context-icon" aria-hidden="true">
                <ArtSvgIcon icon="ri:git-commit-line" />
              </span>
              <div>
                <small>当前工艺路径</small>
                <strong>{{ currentSequenceTitle }}</strong>
                <p>{{ currentSequenceDescription }}</p>
              </div>
              <span class="route-maintenance__sequence-context-count">
                <strong>{{ stepRows.length }}</strong>
                <small>道工序</small>
              </span>
            </div>
          </template>
        </ArtTableQuery>
      </div>

      <ArtTableMultipleSelect
        ref="operationSelectRef"
        v-model="selectedOperationIds"
        :selected-data="selectedOperations"
        :api-fn="fetchOperationOptions"
        :columns="operationColumns"
        label-key="name"
        description-key="code"
        title="批量选择工序"
        subtitle="选择工序集条目后，将按 10、20、30… 自动生成工序号"
        search-placeholder="搜索工序编码、名称或助记码"
        empty-text="暂无可选工序"
        empty-description="请先在工序集中维护启用的标准工序。"
        :show-selected-panel="true"
        @confirm="handleOperationsConfirm"
      >
        <template #trigger></template>
      </ArtTableMultipleSelect>
    </div>
    <template #footer-left>
      <div class="route-maintenance__footer-hint">
        <ArtSvgIcon icon="ri:information-line" aria-hidden="true" />
        <span>{{ currentSequenceDescription }}</span>
      </div>
    </template>
  </ArtDialog>

  <ArtDialog ref="sequenceDialog" size="md">
    <div class="sequence-editor">
      <div v-if="isCreatingParallelSequence" class="sequence-editor__guide">
        <span class="sequence-editor__guide-icon" aria-hidden="true">
          <ArtSvgIcon icon="ri:git-branch-line" />
        </span>
        <div>
          <strong>建立标准序列的并行分支</strong>
          <p>从标准序列中选择分支的转入或转出位置，确认后即可继续维护并行工序。</p>
        </div>
      </div>

      <ArtForm
        ref="sequenceFormRef"
        v-model="sequenceForm"
        :items="sequenceItems"
        :rules="sequenceRules"
        :span="24"
        label-position="top"
        :show-reset="false"
        :show-submit="false"
      >
        <template #transferInStepId>
          <ArtTableSingleSelect
            v-model="transferInStepId"
            :selected-data="transferInSelection"
            :data="transferInStepRows"
            :columns="transferStepColumns"
            :label-key="transferStepLabel"
            :description-key="transferStepDescription"
            title="选择转入工序"
            subtitle="并行分支从所选标准工序之后开始"
            placeholder="从标准序列选择转入工序"
            search-placeholder="搜索工序号、名称或工序编码"
            empty-text="暂无可选转入工序"
            empty-description="标准序列的末道工序不能作为并行分支的转入位置。"
            :show-pagination="false"
          />
        </template>
        <template #transferOutStepId>
          <ArtTableSingleSelect
            v-model="transferOutStepId"
            :selected-data="transferOutSelection"
            :data="transferOutStepRows"
            :columns="transferStepColumns"
            :label-key="transferStepLabel"
            :description-key="transferStepDescription"
            title="选择转出工序"
            subtitle="并行分支在所选标准工序之前汇回"
            placeholder="从标准序列选择转出工序"
            search-placeholder="搜索工序号、名称或工序编码"
            empty-text="暂无可选转出工序"
            empty-description="标准序列的首道工序不能作为并行分支的转出位置。"
            :show-pagination="false"
          />
        </template>
      </ArtForm>

      <div v-if="isCreatingParallelSequence" class="sequence-editor__automation-note">
        <ElTag type="primary" effect="plain" size="small">自动创建</ElTag>
        <span>同时新增工序号为 10 的“待维护工序”，并继承当前路线的生产单位与部门。</span>
      </div>
    </div>
  </ArtDialog>

  <ArtDialog ref="editDialog" size="xl">
    <div class="step-editor">
      <ArtEntitySummary
        class="step-editor__identity"
        icon="ri:settings-3-line"
        eyebrow="PROCESS STEP"
        :title="stepForm.name || '新工序'"
        :description="stepEditorDescription"
      >
        <template #aside>
          <div class="step-editor__identity-aside">
            <span>工序号</span>
            <strong>{{ stepForm.code || '待填写' }}</strong>
          </div>
          <ElTag :type="stepForm.critical ? 'danger' : 'info'" effect="plain">
            {{ stepForm.critical ? '关键工序' : '普通工序' }}
          </ElTag>
        </template>
      </ArtEntitySummary>

      <ElTabs v-model="activeTab" class="step-editor__tabs">
        <ElTabPane v-for="tab in stepTabs" :key="tab.name" :name="tab.name">
          <template #label>
            <span class="step-editor__tab-label">
              <ArtSvgIcon :icon="tab.icon" />
              {{ tab.label }}
              <span v-if="tab.count" class="step-editor__tab-count" :aria-label="`${tab.count} 项`">
                {{ tab.count }}
              </span>
            </span>
          </template>
        </ElTabPane>
      </ElTabs>

      <section class="step-editor__panel">
        <div class="step-editor__section-heading">
          <div>
            <strong>{{ activeStepPanel.title }}</strong>
            <p>{{ activeStepPanel.description }}</p>
          </div>
          <span>{{ activeStepPanel.status }}</span>
        </div>

        <div v-show="activeTab === 'basic'" class="step-editor__content">
          <div v-if="editorReadonly" class="step-editor__detail">
            <ArtDescriptions
              :data="stepForm"
              :items="basicDetailItems"
              :columns="2"
              :tablet-columns="2"
              :mobile-columns="1"
              empty-text="—"
            />
          </div>
          <ArtForm
            v-else
            ref="formRef"
            v-model="stepForm"
            :items="stepItems"
            :rules="stepRules"
            :span="12"
            :gutter="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          >
            <template #humanMachineRatio>
              <div class="step-editor__ratio-field">
                <ElInputNumber
                  v-model="stepForm.operatorCount"
                  :min="1"
                  :max="999"
                  :precision="0"
                  controls-position="right"
                  aria-label="人机系数人数"
                />
                <span>人</span>
                <b aria-hidden="true">:</b>
                <ElInputNumber
                  v-model="stepForm.machineCount"
                  :min="1"
                  :max="999"
                  :precision="0"
                  controls-position="right"
                  aria-label="人机系数设备数"
                />
                <span>台</span>
              </div>
            </template>
          </ArtForm>
        </div>
        <div v-show="activeTab === 'unit'" class="step-editor__content">
          <ElAlert
            v-if="!editorReadonly"
            title="生产单位换算系数 × 生产单位 = 工序单位换算系数 × 工序单位"
            type="info"
            :closable="false"
            show-icon
          />
          <ArtDescriptions
            v-if="editorReadonly"
            :data="unitForm"
            :items="unitDetailItems"
            :columns="2"
            :tablet-columns="2"
            :mobile-columns="1"
            empty-text="—"
          />
          <ArtForm
            v-else
            v-model="unitForm"
            :items="unitItems"
            :span="12"
            :gutter="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          />
          <div class="step-editor__equation" role="status">
            <span>相当于</span>
            <strong>1 {{ route?.productionUnit?.unitName || '生产单位' }}</strong>
            <ArtSvgIcon icon="ri:arrow-right-line" />
            <strong>{{ unitConversionPreview }} {{ operationUnitName }}</strong>
          </div>
        </div>

        <div v-show="activeTab === 'activity'" class="step-editor__content">
          <div class="route-maintenance__tab-toolbar">
            <span>
              {{
                editorReadonly
                  ? '按执行顺序展示工作中心活动，可追溯默认来源。'
                  : '默认带入所选工作中心的活动信息，活动名称及其余参数可按工序调整。'
              }}
            </span>
            <ElButton
              v-if="!editorReadonly && activityRows.length"
              v-auth="'MdmProcessRoute:Edit'"
              type="primary"
              plain
              @click="addActivity"
              ><ArtSvgIcon icon="ri:add-line" />新增活动</ElButton
            >
          </div>
          <ElScrollbar class="route-maintenance__activity-scroll">
            <ArtEmptyState
              v-if="!activityRows.length"
              class="route-maintenance__tab-empty"
              title="暂无活动配置"
              description="选择车间与工作中心后可自动带入活动，也可手工新增。"
            >
              <template v-if="!editorReadonly" #default>
                <ElButton v-auth="'MdmProcessRoute:Edit'" type="primary" plain @click="addActivity"
                  ><ArtSvgIcon icon="ri:add-line" />新增活动</ElButton
                >
              </template>
            </ArtEmptyState>
            <div
              v-if="activityRows.length"
              class="route-maintenance__activity-row is-header"
              :class="{ 'is-readonly': editorReadonly }"
            >
              <span>#</span><span>来源工作中心</span><span>活动名称</span><span>活动类型</span
              ><span>维护规则</span><span>基数数量</span><span>活动单位</span
              ><span>计划活动量公式</span><span>汇报活动量公式</span><span>倒冲</span
              ><span>备注</span
              ><span v-if="!editorReadonly" class="route-maintenance__activity-operation"
                >操作</span
              >
            </div>
            <div
              v-for="(activity, index) in activityRows"
              :key="activity.key"
              class="route-maintenance__activity-row"
              :class="{ 'is-readonly': editorReadonly }"
            >
              <span class="route-maintenance__activity-index">{{ index + 1 }}</span>
              <template v-if="editorReadonly">
                <span class="route-maintenance__activity-value">
                  {{ activity.sourceWorkCenterName || '手工维护' }}
                </span>
                <span class="route-maintenance__activity-value is-strong">
                  {{ activity.name || '—' }}
                </span>
                <span class="route-maintenance__activity-value">
                  {{ dictLabel('mdmActivityType', activity.activityType) }}
                </span>
                <span class="route-maintenance__activity-value">
                  {{ dictLabel('mdmWorkCenterMaintenanceRule', activity.maintenanceRule) }}
                </span>
                <span class="route-maintenance__activity-value is-number">
                  {{ formatQuantity(activity.basicQuantity) }}
                </span>
                <span class="route-maintenance__activity-value">
                  {{ dictLabel('mdmActivityUnit', activity.activityUnit) }}
                </span>
                <span class="route-maintenance__activity-value is-code">
                  {{ activity.planExpression || '—' }}
                </span>
                <span class="route-maintenance__activity-value is-code">
                  {{ activity.reportExpression || '—' }}
                </span>
                <span class="route-maintenance__activity-value">
                  {{ activity.backflush ? '是' : '否' }}
                </span>
                <span class="route-maintenance__activity-value">
                  {{ activity.remark || '—' }}
                </span>
              </template>
              <template v-else>
                <span class="route-maintenance__activity-value">
                  {{ activity.sourceWorkCenterName || '手工维护' }}
                </span>
                <ElInput
                  v-model="activity.name"
                  :aria-label="`第 ${index + 1} 行活动名称`"
                  maxlength="100"
                  placeholder="活动名称"
                />
                <ElSelect
                  v-model="activity.activityType"
                  :aria-label="`第 ${index + 1} 行活动类型`"
                  filterable
                  clearable
                  placeholder="活动类型"
                >
                  <ElOption
                    v-for="item in getDictMap.mdmActivityType ?? []"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
                <ElSelect
                  v-model="activity.maintenanceRule"
                  :aria-label="`第 ${index + 1} 行维护规则`"
                  filterable
                  clearable
                  placeholder="维护规则"
                >
                  <ElOption
                    v-for="item in getDictMap.mdmWorkCenterMaintenanceRule ?? []"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
                <ElInputNumber
                  v-model="activity.basicQuantity"
                  :aria-label="`第 ${index + 1} 行基本数量`"
                  :min="0"
                  :precision="6"
                  controls-position="right"
                />
                <ElSelect
                  v-model="activity.activityUnit"
                  :aria-label="`第 ${index + 1} 行活动单位`"
                  filterable
                  clearable
                  placeholder="活动单位"
                >
                  <ElOption
                    v-for="item in getDictMap.mdmActivityUnit ?? []"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </ElSelect>
                <ElInput
                  v-model="activity.planExpression"
                  :aria-label="`第 ${index + 1} 行计划活动量公式`"
                  placeholder="计划活动量公式"
                />
                <ElInput
                  v-model="activity.reportExpression"
                  :aria-label="`第 ${index + 1} 行汇报活动量公式`"
                  placeholder="汇报活动量公式"
                />
                <ElSwitch v-model="activity.backflush" :aria-label="`第 ${index + 1} 行倒冲`" />
                <ElInput
                  v-model="activity.remark"
                  :aria-label="`第 ${index + 1} 行备注`"
                  maxlength="500"
                  placeholder="备注"
                />
                <div class="route-maintenance__activity-actions">
                  <ArtIconButton
                    icon="ri:arrow-up-line"
                    label="上移活动"
                    :disabled="index === 0"
                    @click="moveActivity(index, -1)"
                  />
                  <ArtIconButton
                    icon="ri:arrow-down-line"
                    label="下移活动"
                    :disabled="index === activityRows.length - 1"
                    @click="moveActivity(index, 1)"
                  />
                  <ArtIconButton
                    icon="ri:delete-bin-6-line"
                    label="删除活动"
                    tone="danger"
                    @click="activityRows.splice(index, 1)"
                  />
                </div>
              </template>
            </div>
          </ElScrollbar>
        </div>

        <div v-show="activeTab === 'outsourcing'" class="step-editor__content">
          <ArtDescriptions
            v-if="editorReadonly"
            :data="outsourcingForm"
            :items="outsourcingDetailItems"
            :columns="2"
            :tablet-columns="2"
            :mobile-columns="1"
            empty-text="—"
          />
          <ArtForm
            v-else
            v-model="outsourcingForm"
            :items="outsourcingItems"
            :span="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          />
        </div>

        <div v-show="activeTab === 'inspection'" class="step-editor__content">
          <ArtDescriptions
            v-if="editorReadonly"
            :data="inspectionForm"
            :items="inspectionDetailItems"
            :columns="2"
            :tablet-columns="2"
            :mobile-columns="1"
            empty-text="—"
          />
          <ArtForm
            v-else
            v-model="inspectionForm"
            :items="inspectionItems"
            :span="12"
            :gutter="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          />
        </div>

        <div v-show="activeTab === 'sop'" class="step-editor__content">
          <ArtDescriptions
            v-if="editorReadonly"
            :data="sopForm"
            :items="sopDetailItems"
            :columns="2"
            :tablet-columns="2"
            :mobile-columns="1"
            empty-text="—"
          />
          <ArtForm
            v-else
            v-model="sopForm"
            :items="sopItems"
            :span="24"
            label-position="top"
            :show-reset="false"
            :show-submit="false"
          >
            <template #attachments>
              <ArtUploadFile
                v-model="sopForm.attachments"
                multiple
                :limit="10"
                :disabled="editorReadonly"
                title="上传作业指导书"
                tip="支持上传附件，也可选择工程主数据中的 ESOP 文档。"
              />
            </template>
          </ArtForm>
        </div>
      </section>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { cloneDeep, groupBy } from 'lodash-es'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtEntitySummary from '@/components/core/surfaces/art-entity-summary/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtTableMultipleSelect from '@/components/core/forms/art-data-select/table-multiple.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryHeaderActionContext
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    DataSelectFetchParams,
    DataSelectKey,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { useUserStore } from '@/store/modules/user'
  import {
    deleteProcessSequence,
    deleteProcessStep,
    deleteProcessSteps,
    fetchOperationalMaster,
    fetchProductionDepartmentTree,
    fetchProcessRouteReferences,
    fetchProcessSequences,
    fetchProcessSteps,
    fetchWorkCenterActivities,
    saveProcessSequence,
    saveProcessStep,
    saveProcessSteps,
    type ProcessRoute,
    type ProcessRouteReference,
    type ProcessRouteReferences,
    type ProductionDepartmentTreeNode,
    type ProcessSequence,
    type ProcessStepActivity,
    type ProcessStep,
    type ProcessStepInput,
    type OperationalMasterRecord,
    type WorkspaceQuery
  } from '@mdm/api'
  import { buildProcessSequencePayload, buildProcessStepPayload } from './process-route-payload'

  interface ActivityRow extends ProcessStepActivity {
    key: string
  }

  type DepartmentTreeOption = Omit<ProductionDepartmentTreeNode, 'children'> & {
    displayLabel: string
    children: DepartmentTreeOption[]
  }

  const user = useUserStore()
  const { getDictMap } = storeToRefs(user)
  const { confirmAction } = useArtFeedback()
  const dialogRef = ref<ArtDialogExpose>()
  const sequenceDialog = ref<ArtDialogExpose>()
  const editDialog = ref<ArtDialogExpose>()
  const tableRef = ref<ArtTableQueryExpose>()
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const sequenceFormRef = ref<InstanceType<typeof ArtForm>>()
  const operationSelectRef = ref<InstanceType<typeof ArtTableMultipleSelect>>()
  const route = shallowRef<ProcessRoute>()
  const readonly = ref(false)
  const maintenanceFullscreen = ref(false)
  const editorReadonly = ref(false)
  const search = reactive({ keyword: '' })
  const activeTab = ref('basic')
  const departmentTree = ref<DepartmentTreeOption[]>([])
  const references = reactive<ProcessRouteReferences>({
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
  const sequenceState = reactive({ loading: false, selectedId: '', rows: [] as ProcessSequence[] })
  const stepRows = ref<ProcessStep[]>([])
  const sequenceStepRows = ref<ProcessStep[]>([])
  const mainStepRows = ref<ProcessStep[]>([])
  const selectedOperationIds = ref<DataSelectKey[]>([])
  const selectedOperations = ref<OperationalMasterRecord[]>([])
  const operationColumns = [
    { prop: 'code', label: '工序编码', minWidth: 140 },
    { prop: 'name', label: '工序名称', minWidth: 180 },
    { prop: 'mnemonic', label: '助记码', minWidth: 120 },
    { prop: 'remark', label: '工序说明', minWidth: 220 }
  ]
  const initialSequence = () => ({
    sequenceNo: 1,
    sequenceType: 'main',
    transferInStepId: null as string | null,
    transferOutStepId: null as string | null,
    remark: '标准序列'
  })
  const sequenceForm = reactive(initialSequence())
  const sequenceEditId = ref('')
  const sequenceCreateType = ref<'main' | 'parallel'>('main')
  const initialStep = (): Omit<ProcessStepInput, 'routeId'> => ({
    sequenceId: null,
    code: '10',
    name: '',
    operationId: null,
    description: '',
    unitId: null,
    basicBatch: 1,
    workCenterId: null,
    workCenterIds: [],
    departmentId: null,
    runOutputQuantity: 1,
    runProcessingMinutes: 1,
    runGreenMinutes: 0,
    setupMinutes: 0,
    operatorCount: 1,
    machineCount: 1,
    queueMinutes: 0,
    transferMinutes: 0,
    minimumTransferQuantity: 1,
    overlapEnabled: false,
    operationMode: 'individual',
    controlCodeId: null,
    processingMode: '',
    reportMode: '',
    inspectionMode: '',
    sequenceControl: '',
    reworkMode: '',
    needInspection: false,
    firstInspection: false,
    firstInspectionControl: 'none',
    isFirst: false,
    isLast: false,
    critical: false,
    unitConversion: {},
    activities: [],
    outsourcing: {},
    inspection: {},
    sopDocuments: [],
    sort: 10
  })
  const stepForm = reactive(initialStep())
  const stepEditId = ref('')
  const unitForm = reactive({ productionFactor: 1, operationFactor: 1, operationUnitId: '' })
  const outsourcingForm = reactive({
    enabled: false,
    purchaseOrganization: '',
    supplierId: '',
    unitPrice: null as number | null,
    remark: ''
  })
  const inspectionForm = reactive({ method: '', standard: '', samplingRule: '', remark: '' })
  const sopForm = reactive({ documentIds: [] as string[], attachments: [] as string[] })
  const activityRows = ref<ActivityRow[]>([])
  const departmentWorkCenters = computed(() =>
    stepForm.departmentId
      ? references.workCenters.filter((item) => item.departmentId === stepForm.departmentId)
      : references.workCenters
  )
  const sequenceTypeLabel = (value: string) =>
    getDictMap.value.mdmProcessRouteSequenceType?.find((item) => item.value === value)?.label ||
    (value === 'main' ? '标准序列' : value)
  const meaningfulSequenceRemark = (item: ProcessSequence): string => {
    const remark = item.remark.trim()
    return remark && remark !== sequenceTypeLabel(item.sequenceType) ? remark : ''
  }
  const sequenceNodeDescription = (item: ProcessSequence): string => {
    const remark = meaningfulSequenceRemark(item)
    if (remark) return remark
    if (item.sequenceType === 'main') return '标准主线'
    if (item.sequenceType === 'parallel') return '并行分支'
    return '返工路径'
  }
  const currentSequence = computed(() =>
    sequenceState.rows.find((item) => item.id === sequenceState.selectedId)
  )
  const sequenceStepsById = computed(() =>
    groupBy(sequenceStepRows.value, (item) => item.sequenceId || '')
  )
  const getSequenceSteps = (sequenceId: string) => sequenceStepsById.value[sequenceId] || []
  const transferInStepRows = computed(() => mainStepRows.value.filter((item) => !item.isLast))
  const transferOutStepRows = computed(() => mainStepRows.value.filter((item) => !item.isFirst))
  const transferInStepId = computed<DataSelectKey | undefined>({
    get: () => sequenceForm.transferInStepId || undefined,
    set: (value) => {
      sequenceForm.transferInStepId = value ? String(value) : null
    }
  })
  const transferOutStepId = computed<DataSelectKey | undefined>({
    get: () => sequenceForm.transferOutStepId || undefined,
    set: (value) => {
      sequenceForm.transferOutStepId = value ? String(value) : null
    }
  })
  const transferInSelection = computed(() =>
    transferInStepRows.value.filter((item) => item.id === sequenceForm.transferInStepId)
  )
  const transferOutSelection = computed(() =>
    transferOutStepRows.value.filter((item) => item.id === sequenceForm.transferOutStepId)
  )
  const transferStepColumns = [
    { prop: 'code', label: '工序号', minWidth: 110 },
    { prop: 'name', label: '工序名称', minWidth: 180 },
    { prop: 'operation.code', label: '工序编码', minWidth: 140 }
  ]
  const transferStepLabel = (row: DataSelectRecord) => `${row.code}｜${row.name}`
  const transferStepDescription = (row: DataSelectRecord) =>
    row.operation?.code ? `工序编码 ${row.operation.code}` : '未关联标准工序'
  const isCreatingParallelSequence = computed(
    () => !sequenceEditId.value && sequenceCreateType.value === 'parallel'
  )
  const canCreateParallelSequence = computed(
    () => transferInStepRows.value.length > 0 && transferOutStepRows.value.length > 0
  )
  const sequenceCreateActionLabel = computed(() => {
    if (!sequenceState.rows.length) return '创建标准序列'
    return canCreateParallelSequence.value
      ? '新增并行序列'
      : '至少维护两道标准工序后，才可新增并行序列'
  })
  const routeSummaryDescription = computed(() =>
    [
      route.value?.code,
      route.value?.name,
      route.value?.version || '默认版本',
      route.value?.productionUnit?.unitName || '多单位共用'
    ]
      .filter(Boolean)
      .join(' · ')
  )
  const currentSequenceSubtitle = computed(() =>
    currentSequence.value
      ? `${currentSequence.value.sequenceNo} · ${sequenceTypeLabel(currentSequence.value.sequenceType)}`
      : '请选择左侧工序序列'
  )
  const stepEditorDescription = computed(
    () => `${route.value?.name || '工艺路线'} · ${currentSequenceSubtitle.value}`
  )
  const stepTabs = computed(() => [
    { name: 'basic', label: '工序明细', icon: 'ri:file-list-3-line', count: 0 },
    { name: 'unit', label: '单位换算', icon: 'ri:exchange-line', count: 0 },
    {
      name: 'activity',
      label: '活动信息',
      icon: 'ri:function-line',
      count: activityRows.value.length
    },
    {
      name: 'outsourcing',
      label: '委外信息',
      icon: 'ri:truck-line',
      count: outsourcingForm.enabled ? 1 : 0
    },
    {
      name: 'inspection',
      label: '检验信息',
      icon: 'ri:shield-check-line',
      count: stepForm.needInspection ? 1 : 0
    },
    {
      name: 'sop',
      label: '作业指导书',
      icon: 'ri:file-shield-2-line',
      count: sopForm.documentIds.length + sopForm.attachments.length
    }
  ])
  const operationUnitName = computed(
    () =>
      references.units.find((item) => item.id === unitForm.operationUnitId)?.name ||
      references.units.find((item) => item.id === stepForm.unitId)?.name ||
      '工序单位'
  )
  const unitConversionPreview = computed(() => {
    const productionFactor = Number(unitForm.productionFactor) || 1
    const operationFactor = Number(unitForm.operationFactor) || 1
    return (productionFactor / operationFactor).toLocaleString('zh-CN', {
      maximumFractionDigits: 6
    })
  })
  const activeStepPanel = computed(() => {
    const count = sopForm.documentIds.length + sopForm.attachments.length
    return (
      {
        basic: {
          title: '工序执行基础',
          description: '定义工序身份、执行组织、批量与控制属性。',
          status: '工序序列与名称为必填项'
        },
        unit: {
          title: '生产与工序单位换算',
          description: '维护生产单位和工序执行单位之间的数量关系。',
          status: '默认按 1 : 1 换算'
        },
        activity: {
          title: '活动量与资源消耗',
          description: '按执行顺序维护计划、汇报表达式与资源。',
          status: `已配置 ${activityRows.value.length} 项`
        },
        outsourcing: {
          title: '委外加工约束',
          description: '启用委外时，指定供应商并记录业务说明。',
          status: outsourcingForm.enabled ? '已启用委外' : '未启用委外'
        },
        inspection: {
          title: '质量检验要求',
          description: '维护检验方式、标准、抽样规则与首检控制。',
          status: stepForm.needInspection ? '需要检验' : '无需检验'
        },
        sop: {
          title: '受控作业指导资料',
          description: '关联工程主数据中的 ESOP，或上传工序专用附件。',
          status: `已关联 ${count} 份`
        }
      } as const
    )[activeTab.value as 'basic' | 'unit' | 'activity' | 'outsourcing' | 'inspection' | 'sop']
  })
  const currentSequenceTitle = computed(() =>
    currentSequence.value
      ? `${currentSequence.value.sequenceNo} · ${sequenceTypeLabel(currentSequence.value.sequenceType)}`
      : '尚未选择序列'
  )
  const currentSequenceDescription = computed(() =>
    currentSequence.value
      ? meaningfulSequenceRemark(currentSequence.value) ||
        '维护该路径下的工序、工作中心与工艺参数。'
      : '从左侧选择现有序列，或创建一条新的工艺路径。'
  )
  const stepEmptyDescription = computed(() =>
    sequenceState.selectedId
      ? readonly.value
        ? '该路径尚未配置工序。'
        : '新增首道工序后，可继续维护单位换算、活动、委外、检验和作业指导书。'
      : '请先在左侧选择或新增一条工序序列。'
  )
  const stepSearchItems = computed<SearchFormItem[]>(() =>
    stepRows.value.length || search.keyword
      ? [
          {
            key: 'keyword',
            label: '工序',
            type: 'input',
            props: { clearable: true, placeholder: '搜索工序号、名称或说明' }
          }
        ]
      : []
  )
  const option = (rows: Array<{ id: string; code: string; name: string }>) =>
    rows.map((item) => ({ label: `${item.name} · ${item.code}`, value: item.id }))
  const dictLabel = (code: string, value: string): string =>
    getDictMap.value[code]?.find((item) => item.value === value)?.label || value || '—'
  const referenceLabel = (rows: ProcessRouteReference[], id: unknown): string => {
    if (!id) return '—'
    const row = rows.find((item) => item.id === id)
    return row ? `${row.name} · ${row.code}` : '—'
  }
  const workCenterSelectionLabel = (ids: string[]): string =>
    ids.length
      ? ids.map((id) => referenceLabel(references.workCenters, id)).join('、')
      : stepForm.departmentId
        ? '全部工作中心'
        : '未指定车间'
  const formatQuantity = (value: number): string =>
    Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 6 })
  const fetchOperationOptions = (params: DataSelectFetchParams) =>
    fetchOperationalMaster('operation', {
      tenantId: route.value?.tenantId || user.info.tenantId || '',
      current: params.page,
      size: params.pageSize,
      keyword: params.keyword,
      enabled: true
    })

  const sequenceItems = computed<FormItem[]>(() => [
    {
      key: 'sequenceNo',
      label: '工序序列',
      type: 'number',
      props: {
        min: 1,
        precision: 0,
        class: '!w-full',
        disabled: Boolean(sequenceEditId.value) && sequenceForm.sequenceType === 'main'
      }
    },
    {
      key: 'sequenceType',
      label: '序列类型',
      type: 'select',
      options: getDictMap.value.mdmProcessRouteSequenceType ?? [],
      props: {
        disabled:
          !sequenceEditId.value ||
          (Boolean(sequenceEditId.value) && sequenceForm.sequenceType === 'main')
      }
    },
    {
      key: 'transferInStepId',
      label: '转入工序',
      type: 'slot',
      hidden: sequenceForm.sequenceType !== 'parallel',
      help: '仅并行序列可设置，不能选择标准工序的末序。'
    },
    {
      key: 'transferOutStepId',
      label: '转出工序',
      type: 'slot',
      hidden: sequenceForm.sequenceType !== 'parallel',
      help: '仅并行序列可设置，不能选择标准工序的首序。'
    },
    { key: 'remark', label: '备注', type: 'textarea', props: { rows: 3, maxlength: 500 } }
  ])
  const sequenceRules = {
    sequenceNo: [{ required: true, message: '请输入工序序列号', trigger: 'blur' }],
    sequenceType: [{ required: true, message: '请选择序列类型', trigger: 'change' }],
    transferOutStepId: [
      {
        validator: (_rule: unknown, value: string | null, callback: (error?: Error) => void) =>
          sequenceForm.sequenceType !== 'parallel' || sequenceForm.transferInStepId || value
            ? callback()
            : callback(new Error('并行序列的转入工序和转出工序不能同时为空')),
        trigger: 'change'
      }
    ]
  }
  const stepItems = computed<FormItem[]>(() => [
    {
      key: 'sequenceId',
      label: '工序序列',
      type: 'select',
      options: sequenceState.rows.map((item) => ({
        label: `${item.sequenceNo} · ${sequenceTypeLabel(item.sequenceType)}`,
        value: item.id
      }))
    },
    { key: 'code', label: '工序号', props: { maxlength: 40 } },
    {
      key: 'operationId',
      label: '工序集',
      type: 'select',
      options: option(references.operations),
      props: { clearable: true, filterable: true, onChange: applyOperation }
    },
    { key: 'name', label: '工序名称', props: { maxlength: 120 } },
    {
      key: 'description',
      label: '工序说明',
      type: 'textarea',
      span: 24,
      props: { rows: 2, maxlength: 500 }
    },
    {
      key: 'unitId',
      label: '工序单位',
      type: 'select',
      options: option(references.units),
      props: { clearable: true, filterable: true }
    },
    {
      key: 'basicBatch',
      label: '基本批量',
      type: 'number',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'departmentId',
      label: '车间',
      type: 'treeSelect',
      help: '选择该工序实际生产所属的车间。',
      props: {
        data: departmentTree.value,
        clearable: true,
        filterable: true,
        checkStrictly: true,
        defaultExpandAll: true,
        nodeKey: 'id',
        props: { label: 'displayLabel', value: 'id', children: 'children' },
        placeholder: '按层级选择生产车间',
        onChange: applyDepartment
      }
    },
    {
      key: 'workCenterIds',
      label: '工作中心',
      type: 'select',
      options: option(departmentWorkCenters.value),
      help: '支持多选；不选择代表该车间内全部工作中心均可生产。',
      props: {
        multiple: true,
        collapseTags: true,
        collapseTagsTooltip: true,
        clearable: true,
        filterable: true,
        placeholder: stepForm.departmentId ? '不选代表全部工作中心' : '请先选择车间',
        disabled: !stepForm.departmentId,
        onChange: applyWorkCenters
      }
    },
    { key: 'timing', label: '工时与产能参数', type: 'divider', span: 24 },
    {
      key: 'runOutputQuantity',
      label: '单趟产出数量（pcs）',
      type: 'number',
      help: '产品单趟生产的理论良品数量。',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'runProcessingMinutes',
      label: '单趟加工时长（分钟）',
      type: 'number',
      help: '包含上下料时长；员工标准工时以此为计件基数。',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'runGreenMinutes',
      label: '单趟绿灯时长（分钟）',
      type: 'number',
      help: '默认为 0；后续用于设备采集加工运行时间，0 表示尚未配置。',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'setupMinutes',
      label: '调机时长（分钟）',
      type: 'number',
      help: '生产前换模、调机与调试的理论用时，排产时计入当前工序。',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'queueMinutes',
      label: '排队时长（分钟）',
      type: 'number',
      help: '工序进入工作中心后的标准等待时间，按规则决定是否计入排产。',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'transferMinutes',
      label: '转运时长（分钟）',
      type: 'number',
      help: '当前工序完成后转移至下一工序的标准时间。',
      props: { min: 0, precision: 6, class: '!w-full' }
    },
    {
      key: 'minimumTransferQuantity',
      label: '最小转移批量',
      type: 'number',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'overlapEnabled',
      label: '允许重叠加工',
      type: 'switch',
      help: '开启后允许达到最小转移批量时提前流转，供高级排产使用。'
    },
    {
      key: 'humanMachineRatio',
      label: '人机系数',
      type: 'slot',
      span: 24,
      help: '按“人数 : 设备数”维护，例如 1 : 3 表示 1 人同时操作 3 台设备；不影响排产。'
    },
    { key: 'control', label: '控制属性', type: 'divider', span: 24 },
    {
      key: 'operationMode',
      label: '作业类型',
      type: 'select',
      options: getDictMap.value.mdmProcessOperationMode ?? []
    },
    {
      key: 'controlCodeId',
      label: '工序控制码',
      type: 'select',
      options: option(references.controlCodes),
      props: { clearable: true, filterable: true, onChange: applyControlCode }
    },
    {
      key: 'processingMode',
      label: '加工类型',
      type: 'select',
      options: getDictMap.value.mdmProcessingMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'reportMode',
      label: '汇报方式',
      type: 'select',
      options: getDictMap.value.mdmReportMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'inspectionMode',
      label: '检验方式',
      type: 'select',
      options: getDictMap.value.mdmInspectionMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'sequenceControl',
      label: '汇报顺序控制',
      type: 'select',
      options: getDictMap.value.mdmSequenceControl ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    {
      key: 'reworkMode',
      label: '返工方式',
      type: 'select',
      options: getDictMap.value.mdmReworkMode ?? [],
      props: { disabled: true, placeholder: '由工序控制码带入' }
    },
    { key: 'needInspection', label: '工序质检', type: 'switch' },
    { key: 'firstInspection', label: '首检', type: 'switch' },
    {
      key: 'firstInspectionControl',
      label: '首检控制',
      type: 'select',
      options: getDictMap.value.mdmProcessSequenceControlMode ?? []
    },
    {
      key: 'isFirst',
      label: '首序',
      type: 'switch',
      props: { disabled: true },
      help: '由当前序列中的工序顺序自动识别'
    },
    {
      key: 'isLast',
      label: '末序',
      type: 'switch',
      props: { disabled: true },
      help: '由当前序列中的工序顺序自动识别'
    },
    { key: 'critical', label: '关键工序', type: 'switch' },
    {
      key: 'sort',
      label: '排序',
      type: 'number',
      props: { min: 0, precision: 0, class: '!w-full' }
    }
  ])
  const unitItems = computed<FormItem[]>(() => [
    {
      key: 'productionFactor',
      label: '生产单位换算系数',
      type: 'number',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'operationFactor',
      label: '工序单位换算系数',
      type: 'number',
      props: { min: 0.000001, precision: 6, class: '!w-full' }
    },
    {
      key: 'operationUnitId',
      label: '工序单位',
      type: 'select',
      options: option(references.units),
      props: { clearable: true, filterable: true }
    }
  ])
  const outsourcingItems = computed<FormItem[]>(() => [
    { key: 'enabled', label: '启用委外', type: 'switch' },
    {
      key: 'purchaseOrganization',
      label: '采购组织',
      type: 'select',
      options: getDictMap.value.mdmMaterialPurchaseOrganization ?? [],
      props: { clearable: true, disabled: !outsourcingForm.enabled }
    },
    {
      key: 'supplierId',
      label: '供应商',
      type: 'select',
      options: option(references.suppliers),
      props: { clearable: true, filterable: true, disabled: !outsourcingForm.enabled }
    },
    {
      key: 'unitPrice',
      label: '委外单价（元）',
      type: 'number',
      props: {
        min: 0,
        precision: 4,
        class: '!w-full',
        disabled: !outsourcingForm.enabled
      }
    },
    { key: 'remark', label: '委外说明', type: 'textarea', props: { rows: 4, maxlength: 1000 } }
  ])
  const inspectionItems = computed<FormItem[]>(() => [
    {
      key: 'method',
      label: '检验方式',
      type: 'select',
      options: getDictMap.value.mdmProcessStepInspectionMode ?? []
    },
    { key: 'samplingRule', label: '抽样规则', type: 'input' },
    {
      key: 'standard',
      label: '检验标准',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000 }
    },
    {
      key: 'remark',
      label: '检验备注',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 1000 }
    }
  ])
  const sopItems = computed<FormItem[]>(() => [
    {
      key: 'documentIds',
      label: '工程主数据 ESOP',
      type: 'select',
      props: { multiple: true, filterable: true, clearable: true },
      options: option(references.esopDocuments)
    },
    { key: 'attachments', label: '上传附件', type: 'slot' }
  ])
  const basicDetailItems = computed<ArtDescriptionItem<typeof stepForm>[]>(() => [
    {
      key: 'sequenceId',
      label: '工序序列',
      field: 'sequenceId',
      formatter: (value) => {
        const sequence = sequenceState.rows.find((item) => item.id === value)
        return sequence
          ? `${sequence.sequenceNo} · ${sequenceTypeLabel(sequence.sequenceType)}`
          : '—'
      }
    },
    { key: 'code', label: '工序号', field: 'code', copyable: true },
    {
      key: 'operationId',
      label: '工序集',
      field: 'operationId',
      formatter: (value) => referenceLabel(references.operations, value)
    },
    { key: 'name', label: '工序名称', field: 'name' },
    { key: 'description', label: '工序说明', field: 'description', span: 2 },
    {
      key: 'unitId',
      label: '工序单位',
      field: 'unitId',
      formatter: (value) => referenceLabel(references.units, value)
    },
    { key: 'basicBatch', label: '基本批量', field: 'basicBatch', format: 'number' },
    {
      key: 'workCenterIds',
      label: '工作中心',
      field: 'workCenterIds',
      formatter: (value) => workCenterSelectionLabel(Array.isArray(value) ? value : [])
    },
    {
      key: 'departmentId',
      label: '车间',
      field: 'departmentId',
      formatter: (value) => referenceLabel(references.departments, value)
    },
    {
      key: 'runOutputQuantity',
      label: '单趟产出数量',
      value: () => `${formatQuantity(stepForm.runOutputQuantity)} pcs`
    },
    {
      key: 'runProcessingMinutes',
      label: '单趟加工时长',
      value: () => `${formatQuantity(stepForm.runProcessingMinutes)} 分钟`
    },
    {
      key: 'runGreenMinutes',
      label: '单趟绿灯时长',
      value: () => `${formatQuantity(stepForm.runGreenMinutes ?? 0)} 分钟`
    },
    {
      key: 'setupMinutes',
      label: '调机时长',
      value: () => `${formatQuantity(stepForm.setupMinutes)} 分钟`
    },
    {
      key: 'queueMinutes',
      label: '排队时长',
      value: () => `${formatQuantity(stepForm.queueMinutes)} 分钟`
    },
    {
      key: 'transferMinutes',
      label: '转运时长',
      value: () => `${formatQuantity(stepForm.transferMinutes)} 分钟`
    },
    {
      key: 'minimumTransferQuantity',
      label: '最小转移批量',
      field: 'minimumTransferQuantity',
      format: 'number'
    },
    {
      key: 'overlapEnabled',
      label: '重叠加工',
      field: 'overlapEnabled',
      formatter: (value) => (value ? '允许' : '不允许')
    },
    {
      key: 'humanMachineRatio',
      label: '人机系数',
      value: () => `${stepForm.operatorCount} 人 : ${stepForm.machineCount} 台`
    },
    {
      key: 'operationMode',
      label: '作业类型',
      field: 'operationMode',
      dictCode: 'mdmProcessOperationMode'
    },
    {
      key: 'controlCodeId',
      label: '工序控制码',
      field: 'controlCodeId',
      formatter: (value) => referenceLabel(references.controlCodes, value)
    },
    {
      key: 'processingMode',
      label: '加工类型',
      field: 'processingMode',
      dictCode: 'mdmProcessingMode'
    },
    {
      key: 'reportMode',
      label: '汇报方式',
      field: 'reportMode',
      dictCode: 'mdmReportMode'
    },
    {
      key: 'inspectionMode',
      label: '检验方式',
      field: 'inspectionMode',
      dictCode: 'mdmInspectionMode'
    },
    {
      key: 'sequenceControl',
      label: '汇报顺序控制',
      field: 'sequenceControl',
      dictCode: 'mdmSequenceControl'
    },
    {
      key: 'reworkMode',
      label: '返工方式',
      field: 'reworkMode',
      dictCode: 'mdmReworkMode'
    },
    {
      key: 'needInspection',
      label: '工序质检',
      field: 'needInspection',
      formatter: (value) => (value ? '需要' : '不需要')
    },
    {
      key: 'firstInspection',
      label: '首检',
      field: 'firstInspection',
      formatter: (value) => (value ? '需要' : '不需要')
    },
    {
      key: 'firstInspectionControl',
      label: '首检控制',
      field: 'firstInspectionControl',
      dictCode: 'mdmProcessSequenceControlMode'
    },
    {
      key: 'critical',
      label: '关键工序',
      field: 'critical',
      formatter: (value) => (value ? '是' : '否')
    },
    {
      key: 'position',
      label: '序列位置',
      value: () =>
        [stepForm.isFirst ? '首序' : '', stepForm.isLast ? '末序' : '']
          .filter(Boolean)
          .join('、') || '普通工序'
    },
    { key: 'sort', label: '排序', field: 'sort', format: 'number' }
  ])
  const unitDetailItems = computed<ArtDescriptionItem<typeof unitForm>[]>(() => [
    {
      key: 'productionUnit',
      label: '生产单位',
      value: () => route.value?.productionUnit?.unitName || '—'
    },
    {
      key: 'operationUnitId',
      label: '工序单位',
      field: 'operationUnitId',
      formatter: (value) => referenceLabel(references.units, value)
    },
    {
      key: 'productionFactor',
      label: '生产单位换算系数',
      field: 'productionFactor',
      format: 'number'
    },
    {
      key: 'operationFactor',
      label: '工序单位换算系数',
      field: 'operationFactor',
      format: 'number'
    }
  ])
  const outsourcingDetailItems = computed<ArtDescriptionItem<typeof outsourcingForm>[]>(() => [
    {
      key: 'enabled',
      label: '委外状态',
      field: 'enabled',
      formatter: (value) => (value ? '已启用' : '未启用')
    },
    {
      key: 'purchaseOrganization',
      label: '采购组织',
      field: 'purchaseOrganization',
      dictCode: 'mdmMaterialPurchaseOrganization'
    },
    {
      key: 'supplierId',
      label: '供应商',
      field: 'supplierId',
      formatter: (value) => referenceLabel(references.suppliers, value)
    },
    { key: 'unitPrice', label: '委外单价（元）', field: 'unitPrice', format: 'number' },
    { key: 'remark', label: '委外说明', field: 'remark', span: 2 }
  ])
  const inspectionDetailItems = computed<ArtDescriptionItem<typeof inspectionForm>[]>(() => [
    {
      key: 'method',
      label: '检验方式',
      field: 'method',
      dictCode: 'mdmProcessStepInspectionMode'
    },
    { key: 'samplingRule', label: '抽样规则', field: 'samplingRule' },
    { key: 'standard', label: '检验标准', field: 'standard', span: 2 },
    { key: 'remark', label: '检验备注', field: 'remark', span: 2 }
  ])
  const sopDetailItems = computed<ArtDescriptionItem<typeof sopForm>[]>(() => [
    {
      key: 'documentIds',
      label: '工程主数据 ESOP',
      field: 'documentIds',
      span: 2,
      formatter: (value) => {
        if (!Array.isArray(value) || !value.length) return '—'
        return value.map((id) => referenceLabel(references.esopDocuments, id)).join('、')
      }
    },
    {
      key: 'attachments',
      label: '上传附件',
      field: 'attachments',
      span: 2,
      formatter: (value) =>
        Array.isArray(value) && value.length ? `已上传 ${value.length} 个附件` : '—'
    }
  ])
  const stepRules = {
    sequenceId: [{ required: true, message: '请选择工序序列', trigger: 'change' }],
    code: [{ required: true, message: '请输入工序号', trigger: 'blur' }],
    name: [{ required: true, message: '请输入工序名称', trigger: 'blur' }],
    departmentId: [{ required: true, message: '请选择生产车间', trigger: 'change' }],
    runOutputQuantity: [{ required: true, message: '请输入单趟产出数量', trigger: 'blur' }],
    runProcessingMinutes: [{ required: true, message: '请输入单趟加工时长', trigger: 'blur' }]
  }
  const fetchRows = async (p: WorkspaceQuery, o?: { signal?: AbortSignal }) => {
    const result = await fetchProcessSteps(
      {
        ...p,
        tenantId: route.value?.tenantId || user.info.tenantId || '',
        routeId: route.value?.id,
        sequenceId: sequenceState.selectedId || undefined
      },
      o
    )
    stepRows.value = result.data
    return result
  }
  const columns = (): ColumnOption<ProcessStep>[] => [
    ...(!readonly.value ? [{ type: 'selection' as const, width: 48, reserveSelection: true }] : []),
    {
      prop: 'sequence',
      label: '工序序列',
      width: 96,
      formatter: (row) => row.sequence?.sequenceNo ?? '—'
    },
    {
      prop: 'sequenceType',
      label: '序列类型',
      width: 110,
      formatter: (row) => sequenceTypeLabel(row.sequence?.sequenceType || '')
    },
    { prop: 'code', label: '工序号', width: 100 },
    {
      prop: 'name',
      label: '工序名称',
      minWidth: 150,
      showOverflowTooltip: true,
      link: { permission: 'MdmProcessRoute:View', onClick: (row) => openStep(row, 'view') }
    },
    {
      prop: 'componentAssignmentCount',
      label: '分配组件',
      width: 96,
      align: 'right',
      formatter: (row) => row.componentAssignmentCount ?? 0
    },
    {
      prop: 'operation',
      label: '工序编码',
      minWidth: 140,
      formatter: (row) => row.operation?.code || '自定义'
    },
    { prop: 'description', label: '工序说明', minWidth: 180, showOverflowTooltip: true },
    {
      prop: 'unit',
      label: '工序单位',
      width: 110,
      formatter: (row) => row.unit?.unitName || '未指定'
    },
    { prop: 'basicBatch', label: '基本批量', width: 100, align: 'right' },
    {
      prop: 'workCenter',
      label: '工作中心',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) =>
        row.workCenterIds?.length
          ? row.workCenterIds
              .map((id) => references.workCenters.find((item) => item.id === id)?.name || id)
              .join('、')
          : row.departmentId
            ? '全部工作中心'
            : '未指定'
    },
    {
      prop: 'department',
      label: '车间',
      minWidth: 130,
      formatter: (row) => row.department?.name || '未指定'
    },
    {
      prop: 'operationMode',
      label: '作业类型',
      width: 110,
      formatter: (row) => dictLabel('mdmProcessOperationMode', row.operationMode)
    },
    {
      prop: 'controlCode',
      label: '工序控制码',
      minWidth: 140,
      formatter: (row) => row.controlCode?.controlCodeName || '未指定'
    },
    {
      prop: 'processingMode',
      label: '加工类型',
      width: 110,
      formatter: (row) => dictLabel('mdmProcessingMode', row.processingMode)
    },
    {
      prop: 'reportMode',
      label: '汇报方式',
      width: 110,
      formatter: (row) => dictLabel('mdmReportMode', row.reportMode)
    },
    {
      prop: 'inspectionMode',
      label: '检验方式',
      width: 110,
      formatter: (row) => dictLabel('mdmInspectionMode', row.inspectionMode)
    },
    {
      prop: 'sequenceControl',
      label: '汇报顺序控制',
      width: 130,
      formatter: (row) => dictLabel('mdmSequenceControl', row.sequenceControl)
    },
    {
      prop: 'reworkMode',
      label: '返工方式',
      width: 110,
      formatter: (row) => dictLabel('mdmReworkMode', row.reworkMode)
    },
    {
      prop: 'needInspection',
      label: '工序质检',
      width: 92,
      align: 'center',
      formatter: (row) => (row.needInspection ? '是' : '否')
    },
    {
      prop: 'firstInspection',
      label: '首检',
      width: 72,
      align: 'center',
      formatter: (row) => (row.firstInspection ? '是' : '否')
    },
    {
      prop: 'firstInspectionControl',
      label: '首检控制方式',
      width: 130,
      formatter: (row) => dictLabel('mdmProcessSequenceControlMode', row.firstInspectionControl)
    },
    {
      prop: 'isFirst',
      label: '首序',
      width: 72,
      align: 'center',
      formatter: (row) => (row.isFirst ? '是' : '否')
    },
    {
      prop: 'isLast',
      label: '末序',
      width: 72,
      align: 'center',
      formatter: (row) => (row.isLast ? '是' : '否')
    },
    {
      prop: 'critical',
      label: '关键',
      width: 80,
      align: 'center',
      formatter: (row) => (row.critical ? '是' : '否')
    },
    ...(!readonly.value
      ? [
          {
            prop: '__actions',
            label: '操作',
            width: 186,
            fixed: 'right' as const,
            formatter: (row: ProcessStep) => (
              <BusinessTableRowActions>
                <ArtButtonTable
                  type="view"
                  permission="MdmProcessRoute:View"
                  onClick={() => void openStep(row, 'view')}
                />
                <ArtButtonTable
                  type="edit"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void openStep(row)}
                />
                <ArtButtonTable
                  icon="ri:file-copy-line"
                  label="复制工序"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void openStep(row, 'copy')}
                />
                <ArtButtonTable
                  type="delete"
                  permission="MdmProcessRoute:Edit"
                  onClick={() => void removeStep(row)}
                />
              </BusinessTableRowActions>
            )
          }
        ]
      : [])
  ]
  const actions = computed<ArtTableQueryHeaderAction[]>(() =>
    readonly.value
      ? []
      : [
          {
            type: 'add',
            label: stepRows.value.length ? '新增' : '新增首道工序',
            permission: 'MdmProcessRoute:Edit',
            disabled: !sequenceState.selectedId,
            onClick: () => void openOperationSelector()
          },
          {
            key: 'insert',
            label: '插入行',
            icon: 'ri:insert-row-bottom',
            permission: 'MdmProcessRoute:Edit',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'insert')
          },
          {
            key: 'copy',
            label: '复制',
            icon: 'ri:file-copy-line',
            permission: 'MdmProcessRoute:Edit',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'copy')
          },
          {
            key: 'view',
            label: '查看',
            icon: 'ri:eye-line',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'view')
          },
          {
            key: 'edit',
            label: '编辑',
            icon: 'ri:edit-line',
            permission: 'MdmProcessRoute:Edit',
            selectionRequired: true,
            disabled: ({ selectedCount }: ArtTableQueryHeaderActionContext) => selectedCount !== 1,
            onClick: ({ selectedRows }) => void openStep(selectedRows[0] as ProcessStep, 'edit')
          },
          {
            type: 'delete',
            label: '删除',
            permission: 'MdmProcessRoute:Edit',
            content: ({ selectedCount }: ArtTableQueryHeaderActionContext) =>
              `确认删除选中的 ${selectedCount} 道工序？`,
            onClick: async ({ selectedRows, api }) => {
              await deleteProcessSteps((selectedRows as ProcessStep[]).map((item) => item.id))
              await Promise.all([api.refreshRemove(), loadSequences()])
            }
          }
        ]
  )

  async function loadSequences() {
    if (!route.value) return
    sequenceState.loading = true
    try {
      const [sequences, steps] = await Promise.all([
        fetchProcessSequences(route.value.id),
        fetchProcessSteps({
          tenantId: route.value.tenantId,
          routeId: route.value.id,
          current: 1,
          size: 1000
        })
      ])
      sequenceState.rows = sequences
      sequenceStepRows.value = steps.data
      if (!sequenceState.rows.some((item) => item.id === sequenceState.selectedId))
        sequenceState.selectedId = sequenceState.rows[0]?.id || ''
      const mainSequenceId = sequenceState.rows.find((item) => item.sequenceType === 'main')?.id
      mainStepRows.value = mainSequenceId ? getSequenceSteps(mainSequenceId) : []
    } finally {
      sequenceState.loading = false
    }
  }
  async function selectSequence(id: string) {
    sequenceState.selectedId = id
    await tableRef.value?.refreshData()
  }
  async function openSequence(row?: ProcessSequence) {
    if (!route.value) return
    sequenceEditId.value = row?.id || ''
    sequenceCreateType.value = row
      ? row.sequenceType === 'main'
        ? 'main'
        : 'parallel'
      : sequenceState.rows.length
        ? 'parallel'
        : 'main'
    Object.assign(
      sequenceForm,
      row
        ? cloneDeep(row)
        : {
            ...initialSequence(),
            sequenceNo: Math.max(0, ...sequenceState.rows.map((item) => item.sequenceNo)) + 1,
            sequenceType: sequenceCreateType.value,
            remark: sequenceCreateType.value === 'parallel' ? '并行序列' : '标准序列'
          }
    )
    await sequenceDialog.value?.handleOpen(undefined, {
      title: row
        ? '编辑工序序列'
        : sequenceCreateType.value === 'parallel'
          ? '新增并行序列'
          : '创建标准序列',
      subtitle:
        sequenceCreateType.value === 'parallel'
          ? '定义并行分支与标准序列的衔接位置'
          : '建立工艺路线的默认主路径',
      confirmText: row
        ? '保存更改'
        : sequenceCreateType.value === 'parallel'
          ? '创建并行序列'
          : '创建序列',
      onOpen: () => sequenceFormRef.value?.clearValidate(),
      onConfirm: async () => {
        try {
          await sequenceFormRef.value?.validate()
          if (sequenceForm.sequenceType !== 'parallel') {
            sequenceForm.transferInStepId = null
            sequenceForm.transferOutStepId = null
          }
          const createdSequenceId = await saveProcessSequence(
            buildProcessSequencePayload({ routeId: route.value!.id, ...sequenceForm }),
            sequenceEditId.value || undefined
          )
          if (isCreatingParallelSequence.value) {
            if (!createdSequenceId) throw new Error('并行序列创建后未返回记录标识')
            try {
              await saveProcessStep(
                buildProcessStepPayload({
                  routeId: route.value!.id,
                  ...initialStep(),
                  sequenceId: createdSequenceId,
                  name: '待维护工序',
                  unitId: route.value!.productionUnitId,
                  departmentId: route.value!.departmentId,
                  isFirst: true,
                  isLast: true
                })
              )
            } catch (error) {
              await deleteProcessSequence(createdSequenceId)
              throw error
            }
            sequenceState.selectedId = createdSequenceId
          }
          await loadSequences()
          await tableRef.value?.refreshData()
          return true
        } catch {
          return false
        }
      }
    })
  }
  async function removeSequence(row: ProcessSequence) {
    if (row.sequenceType === 'main') return
    try {
      await confirmAction(
        `确认删除序列“${row.sequenceNo} · ${sequenceTypeLabel(row.sequenceType)}”？`,
        '删除工序序列',
        { type: 'warning' }
      )
      await deleteProcessSequence(row.id)
      await loadSequences()
      await tableRef.value?.refreshData()
    } catch {
      /* API owns feedback. */
    }
  }
  function applyOperation(value: string) {
    const operation = references.operations.find((item) => item.id === value)
    if (!operation) return
    stepForm.name = operation.name
    if (!stepForm.description) stepForm.description = operation.name
  }
  async function applyDepartment(value: string) {
    stepForm.departmentId = value || null
    const validIds = stepForm.workCenterIds.filter((id) =>
      departmentWorkCenters.value.some((item) => item.id === id)
    )
    await applyWorkCenters(validIds)
  }
  function toDepartmentTreeOptions(rows: ProductionDepartmentTreeNode[]): DepartmentTreeOption[] {
    return rows.map((row) => ({
      ...row,
      displayLabel: `${row.name} · ${row.code}`,
      children: toDepartmentTreeOptions(row.children || [])
    }))
  }
  async function applyWorkCenters(value: string[]) {
    stepForm.workCenterIds = value
    stepForm.workCenterId = value[0] ?? null
    const sourceIds = value.length
      ? value
      : stepForm.departmentId
        ? departmentWorkCenters.value.map((item) => item.id)
        : []
    const activitiesByCenter = await Promise.all(
      sourceIds.map(async (centerId) => ({
        centerId,
        activities: await fetchWorkCenterActivities(centerId)
      }))
    )
    activityRows.value = activitiesByCenter.flatMap(({ centerId, activities }) => {
      const center = references.workCenters.find((item) => item.id === centerId)
      return activities.map((item, index) => ({
        key: crypto.randomUUID(),
        sourceWorkCenterId: centerId,
        sourceWorkCenterName: center?.name || '',
        activityType: item.activityType,
        maintenanceRule: item.maintenanceRule,
        name: item.activityName,
        basicQuantity: item.baseQuantity,
        activityUnit: item.activityUnit,
        planExpression: item.planFormula?.expression || '',
        reportExpression: item.reportFormula?.expression || '',
        backflush: item.backflush,
        remark: item.remark,
        sort: index
      }))
    })
  }
  function applyControlCode(value: string) {
    const controlCode = references.controlCodes.find((item) => item.id === value)
    Object.assign(stepForm, {
      processingMode: controlCode?.processingMode || '',
      reportMode: controlCode?.reportMode || '',
      inspectionMode: controlCode?.inspectionMode || '',
      sequenceControl: controlCode?.sequenceControl || '',
      reworkMode: controlCode?.reworkMode || '',
      needInspection: Boolean(controlCode?.inspectionMode && controlCode.inspectionMode !== 'none')
    })
  }
  function addActivity() {
    activityRows.value.push({
      key: crypto.randomUUID(),
      sourceWorkCenterId: null,
      sourceWorkCenterName: '',
      activityType: '',
      maintenanceRule: 'no_check',
      name: '',
      basicQuantity: 0,
      activityUnit: 'minute',
      planExpression: '',
      reportExpression: '',
      backflush: false,
      remark: '',
      sort: activityRows.value.length
    })
  }
  const activityText = (value: unknown): string => (typeof value === 'string' ? value : '')
  function normalizeActivityUnit(value: unknown): string {
    const raw = activityText(value)
    if (!raw) return 'minute'
    if (['hour', 'minute', 'second'].includes(raw)) return raw
    const unit = references.units.find((item) => item.id === raw || item.code === raw)
    const code = (unit?.code || raw).toLowerCase()
    if (['h', 'hr', 'hour'].includes(code)) return 'hour'
    if (['s', 'sec', 'second'].includes(code)) return 'second'
    if (['min', 'minute'].includes(code)) return 'minute'
    return raw
  }
  function normalizeActivity(item: unknown, index: number): ActivityRow {
    const source: Record<string, unknown> =
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      key: crypto.randomUUID(),
      sourceWorkCenterId:
        typeof source.sourceWorkCenterId === 'string' ? source.sourceWorkCenterId : null,
      sourceWorkCenterName: activityText(source.sourceWorkCenterName || source.resource),
      name: activityText(source.name || source.activityName),
      activityType: activityText(source.activityType),
      maintenanceRule: activityText(source.maintenanceRule) || 'no_check',
      basicQuantity: Number.isFinite(Number(source.basicQuantity ?? source.baseQuantity))
        ? Number(source.basicQuantity ?? source.baseQuantity)
        : 0,
      activityUnit: normalizeActivityUnit(source.activityUnit || source.unitId),
      planExpression: activityText(source.planExpression),
      reportExpression: activityText(source.reportExpression),
      backflush: source.backflush === true,
      remark: activityText(source.remark),
      sort: Number.isInteger(Number(source.sort)) ? Number(source.sort) : index
    }
  }
  function moveActivity(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= activityRows.value.length) return
    const rows = activityRows.value
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
  }
  async function openOperationSelector() {
    if (!sequenceState.selectedId) return
    selectedOperationIds.value = []
    selectedOperations.value = []
    await operationSelectRef.value?.open()
  }
  async function handleOperationsConfirm(_value: unknown, rows: DataSelectRecord[]) {
    if (!route.value || !sequenceState.selectedId || !rows.length) return
    const operations = rows as OperationalMasterRecord[]
    const baseSort = Math.max(0, ...stepRows.value.map((item) => item.sort))
    const inputs = operations.map((operation, index) => {
      const sort = baseSort + (index + 1) * 10
      return buildProcessStepPayload({
        routeId: route.value!.id,
        ...initialStep(),
        sequenceId: sequenceState.selectedId,
        code: String(sort),
        sort,
        operationId: operation.id,
        name: operation.name || operation.code || `工序 ${sort}`,
        description: operation.remark || operation.name || '',
        unitId: route.value!.productionUnitId,
        workCenterId: operation.workCenterIds?.[0] || null,
        workCenterIds: operation.workCenterIds || [],
        departmentId: operation.departmentId || route.value!.departmentId,
        isFirst: stepRows.value.length === 0 && index === 0,
        isLast: index === operations.length - 1
      })
    })
    await saveProcessSteps(inputs)
    selectedOperationIds.value = []
    selectedOperations.value = []
    await Promise.all([tableRef.value?.refreshData(), loadSequences()])
  }
  type StepOpenMode = 'add' | 'insert' | 'copy' | 'view' | 'edit'
  const nextStepNumber = (): number => {
    const generatedNumbers = stepRows.value
      .map((item) => Number(item.code))
      .filter((value) => Number.isInteger(value) && value > 0)
    return Math.floor(Math.max(0, ...generatedNumbers) / 10) * 10 + 10
  }
  async function openStep(row?: ProcessStep, mode: StepOpenMode = row ? 'edit' : 'add') {
    if (!route.value || !sequenceState.selectedId) return
    const editing = mode === 'edit'
    const viewing = mode === 'view'
    const cloning = mode === 'copy'
    const inserting = mode === 'insert'
    editorReadonly.value = viewing || readonly.value
    stepEditId.value = editing ? row?.id || '' : ''
    const nextCode = nextStepNumber()
    const nextSort = Math.max(0, ...stepRows.value.map((item) => item.sort)) + 10
    Object.assign(
      stepForm,
      row && !inserting
        ? {
            ...cloneDeep(row),
            ...(cloning
              ? { code: String(nextCode), sort: nextSort, isFirst: false, isLast: false }
              : {})
          }
        : {
            ...initialStep(),
            sequenceId: sequenceState.selectedId,
            code: String(nextCode),
            sort: nextSort,
            unitId: route.value.productionUnitId,
            departmentId: route.value.departmentId,
            isFirst: stepRows.value.length === 0,
            isLast: true
          }
    )
    stepForm.workCenterIds =
      row && !inserting
        ? [
            ...(row.workCenterIds?.length
              ? row.workCenterIds
              : row.workCenterId
                ? [row.workCenterId]
                : [])
          ]
        : []
    stepForm.runGreenMinutes ??= 0
    stepForm.workCenterId = stepForm.workCenterIds[0] ?? null
    Object.assign(unitForm, {
      productionFactor: 1,
      operationFactor: 1,
      operationUnitId: stepForm.unitId || '',
      ...(!inserting && row?.unitConversion ? row.unitConversion : {})
    })
    Object.assign(outsourcingForm, {
      enabled: false,
      purchaseOrganization: '',
      supplierId: '',
      unitPrice: null,
      remark: '',
      ...(!inserting && row?.outsourcing ? row.outsourcing : {})
    })
    Object.assign(inspectionForm, {
      method: '',
      standard: '',
      samplingRule: '',
      remark: '',
      ...(!inserting && row?.inspection ? row.inspection : {})
    })
    activityRows.value = (!inserting ? row?.activities || [] : []).map(normalizeActivity)
    const sop = !inserting ? row?.sopDocuments || [] : []
    sopForm.documentIds = sop.filter((item) => item.type === 'esop').map((item) => String(item.id))
    sopForm.attachments = sop
      .filter((item) => item.type === 'upload')
      .map((item) => String(item.url))
    activeTab.value = 'basic'
    await editDialog.value?.handleOpen(undefined, {
      title: viewing
        ? '查看工序明细'
        : editing
          ? '编辑工序明细'
          : cloning
            ? '复制工序明细'
            : inserting
              ? '插入工序明细'
              : '新增工序明细',
      subtitle: currentSequenceSubtitle.value,
      confirmText: editing ? '保存更改' : '创建工序',
      showConfirmButton: !editorReadonly.value,
      cancelText: editorReadonly.value ? '关闭' : '取消',
      contentMaxHeight: '72vh',
      onOpen: () => formRef.value?.clearValidate(),
      onConfirm: async () => {
        if (editorReadonly.value) return true
        try {
          await formRef.value?.validate()
          if (
            stepForm.runGreenMinutes !== null &&
            (!Number.isFinite(stepForm.runGreenMinutes) || stepForm.runGreenMinutes < 0)
          ) {
            ElMessage.warning('单趟绿灯时长不能小于 0')
            activeTab.value = 'basic'
            return false
          }
          await saveProcessStep(
            buildProcessStepPayload({
              routeId: route.value!.id,
              ...stepForm,
              unitConversion: cloneDeep(unitForm),
              activities: activityRows.value.map((item) => ({
                sourceWorkCenterId: item.sourceWorkCenterId,
                sourceWorkCenterName: item.sourceWorkCenterName,
                activityType: item.activityType,
                maintenanceRule: item.maintenanceRule,
                name: item.name,
                basicQuantity: item.basicQuantity,
                activityUnit: item.activityUnit,
                planExpression: item.planExpression,
                reportExpression: item.reportExpression,
                backflush: item.backflush,
                remark: item.remark,
                sort: activityRows.value.indexOf(item)
              })),
              outsourcing: cloneDeep(outsourcingForm),
              inspection: cloneDeep(inspectionForm),
              sopDocuments: [
                ...sopForm.documentIds.map((id) => ({ type: 'esop', id })),
                ...sopForm.attachments.map((url) => ({ type: 'upload', url }))
              ]
            }),
            stepEditId.value || undefined
          )
          await Promise.all([tableRef.value?.refreshData(), loadSequences()])
          return true
        } catch {
          return false
        }
      }
    })
  }
  async function removeStep(row: ProcessStep) {
    try {
      await confirmAction(`确认删除工序“${row.code}｜${row.name}”？`, '删除工序', {
        type: 'warning'
      })
      await deleteProcessStep(row.id)
      await Promise.all([tableRef.value?.refreshData(), loadSequences()])
    } catch {
      /* API owns feedback. */
    }
  }
  async function handleOpen(row: ProcessRoute, viewOnly = false) {
    route.value = row
    readonly.value = viewOnly
    maintenanceFullscreen.value = false
    search.keyword = ''
    sequenceState.selectedId = ''
    sequenceStepRows.value = []
    mainStepRows.value = []
    await dialogRef.value?.handleOpen(undefined, {
      title: `工艺维护 · ${row.name}`,
      subtitle: `${row.material?.materialCode || '—'} · ${row.material?.materialName || '未关联产品'}`,
      showConfirmButton: false,
      cancelText: '关闭',
      contentMaxHeight: '78vh',
      loading: true,
      onOpen: async (_data, api) => {
        try {
          await Promise.all(
            [
              'mdmProcessRouteSequenceType',
              'mdmProcessOperationMode',
              'mdmProcessSequenceControlMode',
              'mdmProcessStepInspectionMode',
              'mdmProcessingMode',
              'mdmReportMode',
              'mdmInspectionMode',
              'mdmSequenceControl',
              'mdmReworkMode',
              'mdmMaterialPurchaseOrganization',
              'mdmActivityType',
              'mdmWorkCenterMaintenanceRule',
              'mdmActivityUnit'
            ].map((code) => user.ensureDictLoaded(code))
          )
          const [nextReferences, nextDepartmentTree] = await Promise.all([
            fetchProcessRouteReferences(row.tenantId),
            fetchProductionDepartmentTree(row.tenantId)
          ])
          Object.assign(references, nextReferences)
          departmentTree.value = toDepartmentTreeOptions(nextDepartmentTree)
          await loadSequences()
          await nextTick()
          await tableRef.value?.getData()
        } finally {
          api.setLoading(false)
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .route-maintenance {
    display: flex;
    flex-direction: column;
    gap: var(--art-space-4);
    min-height: 0;

    &__readiness {
      display: flex;
      gap: var(--art-space-4);
      align-items: center;
      margin: 0 var(--art-space-3) 0 0;

      > div {
        display: grid;
        gap: 1px;
        min-width: 72px;
      }

      dt {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }

      dd {
        margin: 0;
        font-size: 18px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
        line-height: 22px;
        color: var(--el-text-color-primary);
      }
    }

    &__workspace {
      display: grid;
      grid-template-columns: minmax(280px, 0.3fr) minmax(0, 1fr);
      gap: var(--art-space-4);
      align-items: stretch;
      height: clamp(400px, 52vh, 520px);
      min-height: 0;
    }

    &__sequences {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;

      :deep(.art-section-card__header) {
        align-items: center;
        margin-bottom: var(--art-space-2);
      }

      :deep(.art-section-card__identity p) {
        margin-left: 0;
      }
    }

    :deep(.route-maintenance__sequence-body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    &__sequence-scroll {
      flex: 1;
      height: 100%;
      min-height: 0;
    }

    &__sequence-tree,
    &__sequence-children {
      padding: 0;
      margin: 0;
      list-style: none;
    }

    &__sequence-branch {
      min-width: 0;

      & + & {
        margin-top: 2px;
      }
    }

    &__sequence {
      display: flex;
      gap: var(--art-space-1);
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 52px;
      padding: var(--art-space-1);
      color: var(--el-text-color-regular);
      text-align: left;
      background: transparent;
      border-radius: var(--el-border-radius-base);
      transition:
        background-color var(--art-motion-duration-fast),
        box-shadow var(--art-motion-duration-fast);

      &:hover,
      &.is-current {
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      }

      &.is-current {
        box-shadow: inset 3px 0 0 var(--theme-color);
      }

      &-select {
        display: grid;
        flex: 1;
        grid-template-columns: 30px minmax(0, 1fr);
        gap: var(--art-space-2);
        align-items: center;
        min-width: 0;
        min-height: 40px;
        padding: 2px;
        font: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
        background: transparent;
        border: 0;
        border-radius: var(--el-border-radius-small);

        &:focus-visible {
          outline: 2px solid var(--theme-color);
          outline-offset: 1px;
        }
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        font-size: var(--art-font-size-caption);
        line-height: 18px;
        color: var(--el-text-color-secondary);
      }
    }

    &__sequence-children {
      position: relative;
      display: grid;
      gap: 0;
      padding: 0 0 var(--art-space-1) var(--art-space-3);
      margin: 0 var(--art-space-1) 0 21px;
      border-left: 1px solid color-mix(in srgb, var(--theme-color) 24%, var(--art-card-border));

      > li {
        position: relative;
        min-width: 0;

        &::before {
          position: absolute;
          top: 50%;
          left: calc(-1 * var(--art-space-3));
          width: 10px;
          height: 1px;
          content: '';
          background: color-mix(in srgb, var(--theme-color) 24%, var(--art-card-border));
        }
      }
    }

    &__sequence-step {
      display: grid;
      grid-template-columns: minmax(24px, auto) minmax(0, max-content) minmax(0, max-content);
      gap: var(--art-space-1);
      align-items: center;
      justify-content: start;
      width: 100%;
      min-width: 0;
      min-height: 28px;
      padding: 2px var(--art-space-1);
      font: inherit;
      font-size: var(--art-font-size-caption);
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: transparent;
      border: 0;
      border-radius: var(--el-border-radius-small);
      transition:
        color var(--art-motion-duration-fast),
        background-color var(--art-motion-duration-fast);

      &:hover {
        color: var(--el-text-color-primary);
        background: color-mix(in srgb, var(--theme-color) 7%, var(--default-box-color));
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 1px;
      }

      &-code {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--theme-color);
      }

      &-name {
        max-width: 112px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &-operation {
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--el-text-color-secondary);
        white-space: nowrap;

        &::before {
          color: var(--el-border-color);
          content: '｜';
        }
      }
    }

    &__sequence-empty {
      padding: 0 0 var(--art-space-1) 53px;
      margin: 0;
      font-size: var(--art-font-size-caption);
      line-height: 24px;
      color: var(--el-text-color-placeholder);
    }

    &__sequence-index {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      font-size: 12px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 18%, var(--art-card-border));
      border-radius: var(--art-control-radius);
    }

    &__sequence-copy {
      display: grid;
      gap: 0;
      min-width: 0;
    }

    &__sequence-actions,
    &__activity-actions {
      display: flex;
      gap: 0;
      align-items: center;
    }

    &__steps {
      min-width: 0;
      height: 100%;
      min-height: 0;

      :deep(.art-search-bar) {
        flex: none;
      }
    }

    &__sequence-context {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr) auto;
      gap: var(--art-space-2);
      align-items: center;
      padding: var(--art-space-2);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
      border-radius: var(--art-control-radius);

      &-icon {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        font-size: 16px;
        color: var(--theme-color);
        background: var(--default-box-color);
        border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--art-card-border));
        border-radius: var(--art-control-radius);
      }

      > div {
        min-width: 0;
      }

      small,
      strong,
      p {
        display: block;
        margin: 0;
      }

      small {
        font-size: 10px;
        font-weight: 700;
        line-height: 16px;
        color: var(--theme-color);
        letter-spacing: 0.08em;
      }

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: var(--art-font-size-body);
        line-height: 22px;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }

      p {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: var(--art-font-size-caption);
        line-height: 19px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }

      &-count {
        display: grid;
        gap: 1px;
        min-width: 52px;
        padding-left: var(--art-space-2);
        text-align: right;
        border-left: 1px solid color-mix(in srgb, var(--theme-color) 16%, transparent);

        strong {
          font-size: 18px;
          font-variant-numeric: tabular-nums;
          line-height: 22px;
          color: var(--theme-color);
        }

        small {
          font-size: var(--art-font-size-caption);
          font-weight: 400;
          line-height: 18px;
          color: var(--el-text-color-secondary);
          letter-spacing: 0;
        }
      }
    }

    &__footer-hint {
      display: flex;
      gap: var(--art-space-2);
      align-items: center;
      min-width: 0;

      svg {
        flex: none;
        color: var(--theme-color);
      }

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &__tab-toolbar {
      display: flex;
      gap: var(--art-space-4);
      align-items: center;
      justify-content: space-between;
      min-height: 36px;
      margin-bottom: var(--art-space-3);
      color: var(--el-text-color-secondary);
    }

    &__activity-scroll {
      height: 390px;
      background: var(--default-box-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-control-radius);
    }

    &__activity-row {
      display: grid;
      grid-template-columns:
        28px minmax(150px, 1fr) minmax(160px, 1fr) minmax(130px, 0.8fr) 140px
        minmax(130px, 0.8fr) minmax(135px, 0.8fr) minmax(200px, 1fr) minmax(200px, 1fr)
        84px minmax(180px, 1fr) 112px;
      gap: var(--art-space-3);
      align-items: center;
      min-width: 1860px;
      min-height: 60px;
      padding: 10px var(--art-space-3);
      border-bottom: 1px solid var(--el-border-color-lighter);
      transition: background-color var(--art-motion-duration-fast) ease;

      &.is-readonly {
        grid-template-columns:
          28px minmax(150px, 1fr) minmax(160px, 1fr) minmax(130px, 0.8fr) 140px
          minmax(130px, 0.8fr) minmax(135px, 0.8fr) minmax(200px, 1fr) minmax(200px, 1fr)
          84px minmax(180px, 1fr);
        min-width: 1736px;
      }

      &:not(.is-header):hover {
        background: color-mix(in srgb, var(--theme-color) 3%, var(--default-box-color));
      }

      &.is-header {
        position: sticky;
        top: 0;
        z-index: 2;
        min-height: 44px;
        padding-block: 10px;
        font-size: var(--art-font-size-caption);
        font-weight: 600;
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color-light);
        box-shadow: inset 0 -1px 0 var(--el-border-color-lighter);
      }

      :deep(.el-select),
      :deep(.el-input),
      :deep(.el-input-number) {
        width: 100%;
        min-width: 0;
      }
    }

    &__activity-index {
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-secondary);
      text-align: center;
    }

    &__activity-operation,
    &__activity-actions {
      position: sticky;
      right: 0;
      z-index: 1;
      align-self: stretch;
      justify-content: center;
      padding-right: var(--art-space-3);
      margin-right: calc(var(--art-space-3) * -1);
      background: var(--default-box-color);
      border-left: 1px solid var(--el-border-color-lighter);
      box-shadow: -10px 0 16px -16px rgb(15 23 42 / 45%);
    }

    &__activity-operation {
      display: flex;
      align-items: center;
      background: var(--el-fill-color-light);
    }

    &__activity-row:not(.is-header):hover &__activity-actions {
      background: color-mix(in srgb, var(--theme-color) 3%, var(--default-box-color));
    }

    &__activity-value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: var(--art-font-size-caption);
      line-height: 20px;
      color: var(--el-text-color-regular);
      white-space: nowrap;

      &.is-strong {
        font-weight: 600;
        color: var(--el-text-color-primary);
      }

      &.is-number {
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      &.is-code {
        font-family: var(--art-font-family-mono, Consolas, monospace);
      }
    }

    &__tab-empty {
      min-height: 220px;
    }
  }

  .sequence-editor {
    display: grid;
    gap: var(--art-space-4);

    &__guide {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-3);
      background: color-mix(in srgb, var(--theme-color) 6%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--art-card-border));
      border-radius: var(--art-control-radius);

      &-icon {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        font-size: 18px;
        color: var(--theme-color);
        background: var(--default-box-color);
        border: 1px solid color-mix(in srgb, var(--theme-color) 16%, var(--art-card-border));
        border-radius: var(--art-control-radius);
      }

      strong,
      p {
        display: block;
        margin: 0;
      }

      strong {
        color: var(--el-text-color-primary);
      }

      p {
        margin-top: 2px;
        font-size: var(--art-font-size-caption);
        line-height: 20px;
        color: var(--el-text-color-secondary);
      }
    }

    &__automation-note {
      display: flex;
      gap: var(--art-space-2);
      align-items: flex-start;
      padding: var(--art-space-3);
      font-size: var(--art-font-size-caption);
      line-height: 22px;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-extra-light);
      border-radius: var(--art-control-radius);

      :deep(.el-tag) {
        flex: none;
        margin-top: 1px;
      }
    }
  }

  .step-editor {
    display: grid;
    gap: 0;

    &__identity {
      margin-bottom: var(--art-space-2);
    }

    &__identity-aside {
      display: grid;
      gap: 1px;
      min-width: 72px;

      span {
        font-size: var(--art-font-size-caption);
        color: var(--el-text-color-secondary);
      }

      strong {
        font-size: var(--art-font-size-body);
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-primary);
      }
    }

    &__tabs {
      :deep(.el-tabs__header) {
        margin: 0;
      }

      :deep(.el-tabs__nav-wrap::after) {
        height: 1px;
        background: var(--el-border-color-lighter);
      }

      :deep(.el-tabs__item) {
        min-width: 128px;
        height: 40px;
        padding: 0 var(--art-space-4);
      }

      :deep(.el-tabs__content) {
        display: none;
      }
    }

    &__tab-label {
      display: inline-flex;
      gap: var(--art-space-2);
      align-items: center;
    }

    &__tab-count {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      margin-left: -2px;
      font-size: 10px;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
      line-height: 16px;
      color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 16%, transparent);
      border-radius: 999px;
      transform: translateY(-1px);
    }

    &__panel {
      min-height: 470px;
      padding: var(--art-space-4);
      background: color-mix(in srgb, var(--el-fill-color-extra-light) 45%, var(--el-bg-color));
      border: 1px solid var(--el-border-color-lighter);
      border-top: 0;
      border-radius: 0 0 var(--el-border-radius-base) var(--el-border-radius-base);
    }

    &__section-heading {
      display: flex;
      gap: var(--art-space-3);
      align-items: center;
      justify-content: space-between;
      padding-bottom: var(--art-space-3);
      margin-bottom: var(--art-space-3);
      border-bottom: 1px solid var(--el-border-color-extra-light);

      strong,
      p {
        display: block;
        margin: 0;
      }

      p,
      > span {
        margin-top: 3px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      > span {
        flex: none;
        padding: 4px 8px;
        background: var(--el-fill-color-lighter);
        border-radius: 999px;
      }
    }

    &__content {
      display: grid;
      gap: var(--art-space-4);
      min-width: 0;
    }

    &__ratio-field {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto minmax(0, 1fr) auto;
      gap: var(--art-space-2);
      align-items: center;

      :deep(.el-input-number) {
        width: 100%;
      }

      span {
        color: var(--el-text-color-secondary);
      }

      b {
        color: var(--theme-color);
      }
    }

    &__detail,
    &__content {
      :deep(.art-descriptions .el-descriptions__label) {
        width: 148px;
        padding: 13px var(--art-space-4);
        background: color-mix(in srgb, var(--art-gray-100) 78%, var(--default-box-color));
      }

      :deep(.art-descriptions .el-descriptions__content) {
        padding: 13px var(--art-space-4);
        line-height: 21px;
        background: var(--default-box-color);
      }

      :deep(.art-descriptions .el-descriptions__table) {
        table-layout: fixed;
      }
    }

    &__equation {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
      gap: var(--art-space-3);
      align-items: center;
      padding: var(--art-space-3) var(--art-space-4);
      color: var(--el-text-color-secondary);
      background: color-mix(in srgb, var(--theme-color) 5%, var(--el-bg-color));
      border: 1px solid color-mix(in srgb, var(--theme-color) 14%, var(--art-card-border));
      border-radius: var(--art-control-radius);

      strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }

      svg {
        color: var(--theme-color);
      }
    }
  }

  @media (width <= 1180px) {
    .route-maintenance {
      &__readiness {
        gap: var(--art-space-3);
      }

      &__workspace {
        grid-template-columns: minmax(264px, 0.32fr) minmax(0, 1fr);
      }
    }
  }

  @media (width <= 900px) {
    .route-maintenance {
      &__workspace {
        grid-template-columns: minmax(0, 1fr);
        height: auto;
      }

      &__sequence-scroll {
        height: 200px;
      }

      &__steps {
        height: 440px;
      }

      &__footer-hint {
        display: none;
      }
    }

    .step-editor {
      &__tabs {
        :deep(.el-tabs__item) {
          min-width: auto;
          padding: 0 var(--art-space-3);
        }
      }

      &__panel {
        padding: var(--art-space-3);
      }

      &__section-heading {
        align-items: flex-start;

        > span {
          display: none;
        }
      }
    }
  }

  @media (width > 900px) {
    .route-maintenance.is-fullscreen {
      height: max(400px, calc(100dvh - 176px));
    }

    .route-maintenance.is-fullscreen .route-maintenance__workspace {
      flex: 1;
      height: auto;
      min-height: 0;
    }

    :global(.process-route-maintenance-dialog.el-dialog.is-fullscreen) {
      position: fixed;
      inset: 0;
      box-sizing: border-box;
      width: 100vw !important;
      max-width: none;
      height: 100dvh;
      max-height: 100dvh;
      margin: 0 !important;
      border-radius: 0;
    }

    :global(.process-route-maintenance-dialog.is-fullscreen > .el-dialog__body) {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    :global(
      .process-route-maintenance-dialog.is-fullscreen > .el-dialog__body > .art-dialog__scrollbar
    ) {
      flex: 1;
      height: auto !important;
      min-height: 0;
    }

    :global(
      .process-route-maintenance-dialog.is-fullscreen .art-dialog__scrollbar > .el-scrollbar__wrap
    ) {
      position: absolute;
      inset: 0;
    }

    :global(
      .process-route-maintenance-dialog.is-fullscreen
        .art-dialog__scrollbar
        > .el-scrollbar__wrap
        > .el-scrollbar__view
    ) {
      display: flex;
      min-height: 100%;
    }

    :global(.process-route-maintenance-dialog.is-fullscreen .art-dialog__content),
    :global(.process-route-maintenance-dialog.is-fullscreen .art-overlay-loading),
    :global(.process-route-maintenance-dialog.is-fullscreen .art-overlay-loading__content) {
      display: flex;
      flex: 1;
      width: 100%;
      min-height: 0;
    }
  }
</style>
