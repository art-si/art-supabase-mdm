<template>
  <ArtPermissionGuard permission="MdmAccessoryProcessing:View" resource-name="配件加工清单">
    <div class="business-workspace-page min-w-0 space-y-4 p-4 lg:p-6">
      <BusinessWorkspaceHeader
        eyebrow="ACCESSORY PROCESSING"
        title="配件加工清单"
        description="上传图片、PDF 或 DOCX，校对每件规格与草图，再生成项目物料、BOM 和生产加工单。"
        icon="ri:shape-2-line"
        :tags="[
          { label: '一长度一加工件', type: 'primary' },
          { label: '图文绑定', type: 'success' },
          { label: '人工校对后生成', type: 'info' }
        ]"
      />

      <ArtSectionCard
        title="上传与识别"
        subtitle="原件与逐件草图保存在当前租户的私有文件区。"
        :preserve-content-structure="true"
      >
        <template #actions>
          <ElButton @click="downloadTemplate">下载统一模板</ElButton>
        </template>
        <div class="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,320px)]">
          <div class="min-w-0 space-y-3">
            <label class="block text-sm font-medium">目标租户</label>
            <ElSelect
              v-if="isPlatformSuper && !effectiveTenantId"
              v-model="workspace.tenantId"
              filterable
              placeholder="先选择清单所属租户"
              class="w-full"
              @change="resetUpload"
            >
              <ElOption
                v-for="tenant in tenantOptions"
                :key="tenant.id"
                :label="tenant.tenantName || tenant.tenantCode"
                :value="tenant.id"
              />
            </ElSelect>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ activeTenantName }}</p>
            <ArtUploadFile
              v-model="workspace.sourceUrl"
              title="选择加工清单"
              :file-name="workspace.sourceName"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.docx"
              tip="支持图片、PDF、DOCX；每次识别前 3 页，单文件不超过 20 MB。旧版 DOC 请先另存为 DOCX。"
              :file-size="20 * 1024 * 1024"
              :disabled="!workspace.tenantId || workspace.recognizing || workspace.saving"
              :show-resource-picker="false"
              :upload-request="uploadSource"
              @resource-change="onSourceUploaded"
            />
          </div>
          <div class="flex min-w-0 flex-col justify-end gap-3">
            <ElButton
              v-auth="'MdmAccessoryProcessing:Recognize'"
              type="primary"
              :disabled="!workspace.pages.length || workspace.recognizing || workspace.saving"
              :loading="workspace.recognizing"
              @click="recognize"
              >识别清单内容</ElButton
            >
            <p class="text-xs leading-5 text-gray-500 dark:text-gray-400"
              >识别内容仅作为草稿。生成前请逐条检查长度、数量、材质和草图。</p
            >
          </div>
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        id="accessory-recognition-result"
        class="scroll-mt-28"
        title="识别结果与校对"
        :subtitle="`共 ${draft.items.length} 个独立加工件，来自 ${rowGroups.length} 个原表行；每种长度独立编码与下单。`"
        :loading="workspace.recognizing"
        :error="workspace.recognitionError"
        error-title="清单识别未完成"
        :empty="!draft.items.length && !workspace.recognitionError"
        empty-title="尚无识别结果"
        empty-description="上传清单并点击识别，或在下方打开识别记录、已保存草稿。"
      >
        <template #actions>
          <ElTag v-if="draft.status === 'generated'" type="success">已生成</ElTag>
          <ElTag v-else-if="draft.id" type="warning">待生成</ElTag>
        </template>
        <template #error-action>
          <ElButton type="primary" :disabled="!workspace.pages.length" @click="recognize"
            >重新识别</ElButton
          >
        </template>
        <div class="space-y-4 pt-4">
          <div
            v-if="!isPlatformSuper || draft.status === 'generated'"
            class="grid gap-4 rounded-[var(--custom-radius)] bg-[var(--art-gray-100)] p-4 md:grid-cols-3 dark:bg-[var(--art-gray-200)]"
          >
            <div class="min-w-0">
              <p class="text-xs text-gray-600 dark:text-gray-300">项目名称</p>
              <p class="mt-1 break-words text-sm font-semibold">{{
                draft.projectName || '待确认'
              }}</p>
            </div>
            <div class="min-w-0">
              <p class="text-xs text-gray-600 dark:text-gray-300">图纸名称</p>
              <p class="mt-1 break-words text-sm font-semibold">{{
                draft.drawingName || '待确认'
              }}</p>
            </div>
            <div class="min-w-0">
              <p class="text-xs text-gray-600 dark:text-gray-300">识别状态</p>
              <p class="mt-1 text-sm font-medium">{{ draft.id ? '已保存清单' : '识别预览' }}</p>
            </div>
          </div>
          <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label class="block min-w-0 space-y-2 text-sm font-medium"
              >项目名称
              <ElInput
                v-model="draft.projectName"
                maxlength="160"
                placeholder="识别或手动填写项目名称"
              />
            </label>
            <label class="block min-w-0 space-y-2 text-sm font-medium"
              >关联已有项目
              <ElSelect
                v-model="draft.projectId"
                clearable
                filterable
                placeholder="可选；留空将按名称自动查找或创建"
                class="w-full"
                :disabled="workspace.projectsLoading"
                @change="onProjectSelected"
              >
                <ElOption
                  v-for="project in workspace.projects"
                  :key="project.id"
                  :value="project.id"
                  :label="`${project.projectName} · ${project.projectCode}`"
                />
              </ElSelect>
            </label>
            <label class="block min-w-0 space-y-2 text-sm font-medium"
              >图纸名称
              <ElInput
                v-model="draft.drawingName"
                maxlength="160"
                placeholder="识别或手动填写图纸名称"
              />
            </label>
            <label v-if="isPlatformSuper" class="block min-w-0 space-y-2 text-sm font-medium"
              >项目客户
              <ElSelect
                v-model="draft.customerId"
                clearable
                filterable
                placeholder="新建项目时必选"
                class="w-full"
                :disabled="Boolean(draft.projectId)"
              >
                <ElOption
                  v-for="customer in workspace.customers"
                  :key="customer.id"
                  :value="customer.id"
                  :label="customer.customerName"
                />
              </ElSelect>
            </label>
            <label v-if="isPlatformSuper" class="block min-w-0 space-y-2 text-sm font-medium"
              >物料分类
              <ElSelect
                v-model="draft.categoryId"
                clearable
                filterable
                placeholder="选择加工件所属分类"
                class="w-full"
              >
                <ElOption
                  v-for="category in workspace.categories"
                  :key="category.id"
                  :value="category.id"
                  :label="category.categoryName"
                />
              </ElSelect>
            </label>
          </div>
          <ElAlert v-if="draft.warnings.length" type="warning" :closable="false" show-icon>
            <template #title>待核对提示 · {{ draft.warnings.length }} 项</template>
            <ul class="mt-1 list-disc space-y-1 pl-4 text-sm">
              <li v-for="(warning, index) in draft.warnings" :key="index">{{ warning }}</li>
            </ul>
          </ElAlert>
          <div class="space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm text-gray-600 dark:text-gray-300">
                按原表行查看 · 已展开 {{ expandedRowKeys.length }}/{{ rowGroups.length }} 行
              </p>
              <div class="flex items-center gap-2">
                <ElButton
                  link
                  type="primary"
                  :disabled="expandedRowKeys.length === rowGroups.length"
                  @click="expandedRowKeys = rowGroups.map((group) => group.key)"
                  >展开全部</ElButton
                >
                <ElButton
                  link
                  :disabled="expandedRowKeys.length === 0"
                  @click="expandedRowKeys = []"
                  >收起全部</ElButton
                >
              </div>
            </div>
            <ElCollapse v-model="expandedRowKeys" class="accessory-result-collapse">
              <ElCollapseItem v-for="group in rowGroups" :key="group.key" :name="group.key">
                <template #title>
                  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-1">
                    <span class="shrink-0 text-xs font-medium text-gray-600 dark:text-gray-300"
                      >原表第 {{ group.rowNo }} 行</span
                    >
                    <strong class="min-w-0 break-words text-sm">{{
                      group.entries[0]?.item.name || '未命名构件'
                    }}</strong>
                    <span class="text-xs text-gray-600 dark:text-gray-300"
                      >{{ group.entries.length }} 个加工件</span
                    >
                    <span
                      class="min-w-0 break-words text-xs tabular-nums text-gray-600 dark:text-gray-300"
                      >长度 {{ group.lengthSummary }}</span
                    >
                    <ElTag v-if="group.hasWarning" type="warning" size="small">需核对</ElTag>
                  </div>
                </template>
                <div class="divide-y divide-gray-100 dark:divide-gray-700">
                  <div
                    v-for="{ item, index } in group.entries"
                    :key="item.id || `${item.rowNo}-${index}`"
                  >
                    <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                      <span
                        class="w-11 shrink-0 text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300"
                        >#{{ String(index + 1).padStart(2, '0') }}</span
                      >
                      <div class="min-w-20">
                        <p class="text-xs text-gray-600 dark:text-gray-300">长度</p>
                        <p class="mt-0.5 text-base font-semibold tabular-nums"
                          >{{ item.lengthM.toFixed(3) }}
                          <span class="text-xs font-normal">m</span></p
                        >
                      </div>
                      <div class="min-w-16">
                        <p class="text-xs text-gray-600 dark:text-gray-300">数量</p>
                        <p class="mt-0.5 text-sm font-medium tabular-nums"
                          >{{ item.quantity }} 件</p
                        >
                      </div>
                      <div class="min-w-20">
                        <p class="text-xs text-gray-600 dark:text-gray-300">展宽</p>
                        <p class="mt-0.5 text-sm font-medium tabular-nums"
                          >{{ item.widthMm ?? '—' }} mm</p
                        >
                      </div>
                      <div class="min-w-28 flex-1">
                        <p class="text-xs text-gray-600 dark:text-gray-300">材质与颜色</p>
                        <p class="mt-0.5 break-words text-sm font-medium">{{
                          item.materialColor || '待确认'
                        }}</p>
                      </div>
                      <div class="min-w-32 flex-1">
                        <p class="text-xs text-gray-600 dark:text-gray-300">备注</p>
                        <p class="mt-0.5 break-words text-sm">{{ item.remark || '—' }}</p>
                      </div>
                      <div class="w-20 shrink-0">
                        <p class="text-xs text-gray-600 dark:text-gray-300">独立草图</p>
                        <ElImage
                          v-if="workspace.sketchUrls[index]"
                          :src="workspace.sketchUrls[index]"
                          :preview-src-list="[workspace.sketchUrls[index]]"
                          :alt="`${item.name} ${item.lengthM} 米加工草图`"
                          fit="contain"
                          class="mt-1 h-14 w-20 rounded border border-gray-200 bg-white dark:border-gray-700"
                        />
                        <p v-else class="mt-1 text-xs text-amber-700 dark:text-amber-400"
                          >待补草图</p
                        >
                      </div>
                      <ElButton
                        v-if="isPlatformSuper && draft.status !== 'generated'"
                        link
                        type="primary"
                        :aria-label="`${editingIndex === index ? '收起' : '校对'}加工件 ${index + 1}`"
                        @click="editingIndex = editingIndex === index ? null : index"
                        >{{ editingIndex === index ? '收起' : '校对' }}</ElButton
                      >
                      <ElTag v-else-if="item.materialId" type="success" size="small"
                        >已生成物料</ElTag
                      >
                    </div>
                    <div
                      v-if="
                        editingIndex === index && isPlatformSuper && draft.status !== 'generated'
                      "
                      class="grid gap-3 border-t border-gray-100 bg-[var(--art-gray-100)] px-4 py-4 md:grid-cols-2 xl:grid-cols-6 dark:border-gray-700 dark:bg-[var(--art-gray-200)]"
                    >
                      <label class="min-w-0 space-y-1 text-xs"
                        >构件名称<ElInput v-model="item.name"
                      /></label>
                      <label class="min-w-0 space-y-1 text-xs"
                        >展宽 mm<ElInputNumber
                          v-model="item.widthMm"
                          :min="0"
                          :precision="1"
                          controls-position="right"
                          class="w-full!"
                      /></label>
                      <label class="min-w-0 space-y-1 text-xs"
                        >长度 m<ElInputNumber
                          v-model="item.lengthM"
                          :min="0.001"
                          :precision="3"
                          controls-position="right"
                          class="w-full!"
                      /></label>
                      <label class="min-w-0 space-y-1 text-xs"
                        >数量 件<ElInputNumber
                          v-model="item.quantity"
                          :min="1"
                          :precision="0"
                          controls-position="right"
                          class="w-full!"
                      /></label>
                      <label class="min-w-0 space-y-1 text-xs md:col-span-2"
                        >材质与颜色<ElInput v-model="item.materialColor"
                      /></label>
                      <label class="min-w-0 space-y-1 text-xs md:col-span-2 xl:col-span-5"
                        >备注<ElInput v-model="item.remark"
                      /></label>
                      <div class="space-y-1 text-xs"
                        ><span>独立加工草图</span>
                        <ArtUploadImage
                          :model-value="workspace.sketchUrls[index] || ''"
                          :upload-request="(file) => uploadSketch(file, index)"
                          :show-resource-picker="false"
                          title="补传草图"
                          :size="96"
                          @resource-change="(resources) => onSketchUploaded(resources, index)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </ElCollapseItem>
            </ElCollapse>
          </div>
          <div
            class="flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-700"
          >
            <ElButton
              v-if="isPlatformSuper"
              v-auth="'MdmAccessoryProcessing:SaveDraft'"
              :disabled="draft.status === 'generated' || workspace.saving"
              :loading="workspace.saving"
              @click="saveDraft"
              >保存校对草稿</ElButton
            >
            <ElButton
              v-if="isPlatformSuper"
              v-auth="'MdmAccessoryProcessing:Generate'"
              type="primary"
              :disabled="
                draft.status === 'generated' || !draft.items.length || workspace.generating
              "
              :loading="workspace.generating"
              @click="generate"
              >生成项目物料、BOM 与加工单</ElButton
            >
          </div>
          <ElAlert
            v-if="!isPlatformSuper && draft.status !== 'generated'"
            type="info"
            :closable="false"
            title="识别结果仅供预览；保存草稿及生成业务单据由平台超级管理员操作。"
          />
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        v-if="draft.status === 'generated'"
        title="生产加工单"
        subtitle="每个长度与数量组合对应一张独立加工单，并保留对应草图。"
        :loading="workspace.ordersLoading"
        :error="workspace.ordersError"
        :empty="!workspace.orders.length"
        empty-title="暂无加工单"
        @retry="loadOrders"
      >
        <div class="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="card in orderCards" :key="card.order.id" class="art-card-xs min-w-0 p-4">
            <div class="flex items-start justify-between gap-2">
              <strong class="break-all">{{ card.order.orderNo }}</strong>
              <ElTag size="small" type="info">待生产</ElTag>
            </div>
            <p class="mt-2 text-sm font-medium">{{ card.item?.name || '加工件' }}</p>
            <p class="mt-1 break-all text-xs text-gray-500">物料 {{ card.materialCode }}</p>
            <div class="mt-3 flex gap-3 border-t border-gray-200 pt-3 dark:border-gray-700">
              <img
                v-if="card.sketchUrl"
                :src="card.sketchUrl"
                :alt="`${card.item?.name || '加工件'}的加工草图`"
                width="80"
                height="80"
                class="h-20 w-20 shrink-0 rounded border border-gray-200 object-contain dark:border-gray-700"
              />
              <div class="min-w-0 space-y-1 text-sm">
                <p>{{ card.order.lengthM }} m × {{ card.order.quantity }} 件</p>
                <p v-if="card.item?.widthMm" class="text-gray-500"
                  >展宽 {{ card.item.widthMm }} mm</p
                >
                <p v-if="card.item?.materialColor" class="break-words text-gray-500">{{
                  card.item.materialColor
                }}</p>
              </div>
            </div>
            <p v-if="card.item?.remark" class="mt-3 break-words text-xs text-gray-500">{{
              card.item.remark
            }}</p>
          </div>
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        title="我的识别记录"
        subtitle="识别完成后自动留存，可重新查看结果和独立草图；此处记录尚未成为业务清单。"
        :loading="workspace.recognitionsLoading"
        :error="workspace.recognitionsError"
        :empty="!workspace.recognitions.length"
        empty-title="暂无识别记录"
        empty-description="上传清单并完成一次识别后，这里会保留预览记录。"
        @retry="loadRecognitions"
      >
        <template #actions><ElButton @click="loadRecognitions">刷新记录</ElButton></template>
        <div class="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="record in workspace.recognitions"
            :key="record.id"
            type="button"
            class="art-card-xs min-w-0 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-color)]"
            :disabled="Boolean(workspace.openingRecognitionId)"
            @click="openRecognition(record)"
          >
            <div class="flex items-start justify-between gap-3">
              <strong class="min-w-0 break-words text-sm">{{
                record.projectName || '未识别项目名称'
              }}</strong>
              <ElTag size="small" type="info">识别预览</ElTag>
            </div>
            <p class="mt-2 break-words text-sm text-gray-600 dark:text-gray-300">{{
              record.drawingName || '未识别图纸名称'
            }}</p>
            <p class="mt-2 text-xs text-gray-600 dark:text-gray-300"
              >{{ record.items.length }} 件 · {{ formatDateTime(record.createTime) }}</p
            >
            <p v-if="workspace.openingRecognitionId === record.id" class="mt-2 text-xs"
              >正在打开…</p
            >
          </button>
        </div>
      </ArtSectionCard>

      <ArtSectionCard
        title="已保存清单"
        subtitle="平台超级管理员保存的草稿与已生成清单；识别预览见上方。"
        :loading="workspace.loading"
        :error="workspace.error"
        :empty="!workspace.lists.length"
        empty-title="暂无配件加工清单"
        empty-description="当前没有已保存的业务清单。识别预览会留在上方的“我的识别记录”中。"
        @retry="loadLists"
      >
        <div class="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="list in workspace.lists"
            :key="list.id"
            type="button"
            class="art-card-xs min-w-0 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            @click="openList(list)"
          >
            <div class="flex items-start justify-between gap-2"
              ><strong class="min-w-0 truncate">{{ list.projectName || list.sourceName }}</strong
              ><ElTag :type="list.status === 'generated' ? 'success' : 'warning'" size="small">{{
                list.status === 'generated' ? '已生成' : '草稿'
              }}</ElTag></div
            >
            <p class="mt-2 truncate text-sm text-gray-500">{{
              list.drawingName || list.sourceName
            }}</p>
            <p class="mt-2 text-xs text-gray-400"
              >{{ list.items?.length || 0 }} 件 · {{ formatDateTime(list.createTime) }}</p
            >
          </button>
        </div>
      </ArtSectionCard>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
  import { storeToRefs } from 'pinia'
  import { ElCollapse, ElCollapseItem, ElMessage } from 'element-plus'
  import ArtPermissionGuard from '@/components/core/feedback/art-permission-guard/index.vue'
  import BusinessWorkspaceHeader from '@/components/business/business-workspace-header/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { useTenantScopeStore } from '@/store/modules/tenantScope'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { createDateTimeFormatter } from '@/utils/ui/format'
  import {
    fetchAccessoryCategories,
    fetchAccessoryCustomers,
    fetchAccessoryLists,
    fetchAccessoryRecognitions,
    fetchAccessoryProjects,
    fetchAccessoryWorkOrders,
    finalizeAccessoryList,
    recognizeAccessoryPages,
    restoreAccessoryRecognitionFiles,
    saveAccessoryDraft,
    signAccessoryPath,
    uploadAccessoryFile,
    type AccessoryProcessingItem,
    type AccessoryProcessingList,
    type AccessoryRecognitionRecord,
    type AccessoryProjectOption,
    type AccessoryCustomerOption,
    type AccessoryCategoryOption,
    type AccessoryWorkOrder
  } from '@mdm/api'
  import { cropSketch, rasterizeProcessingList, type DocumentPage } from './modules/document-pages'

  defineOptions({ name: 'MdmAccessoryProcessing' })
  const templateUrl = new URL('./assets/accessory-processing-template.docx', import.meta.url).href
  const { confirmAction } = useArtFeedback()
  const { isPlatformSuper } = storeToRefs(useUserStore())
  const { effectiveTenantId, tenantOptions } = storeToRefs(useTenantScopeStore())
  const formatDateTime = createDateTimeFormatter()
  interface WorkspaceState {
    tenantId: string
    sourceUrl: string
    sourcePath: string
    sourceName: string
    groupId: string
    pages: DocumentPage[]
    sketchUrls: string[]
    lists: AccessoryProcessingList[]
    recognitions: AccessoryRecognitionRecord[]
    projects: AccessoryProjectOption[]
    customers: AccessoryCustomerOption[]
    categories: AccessoryCategoryOption[]
    orders: AccessoryWorkOrder[]
    loading: boolean
    recognitionsLoading: boolean
    recognitionsError: string
    openingRecognitionId: string
    projectsLoading: boolean
    ordersLoading: boolean
    recognizing: boolean
    recognitionError: string
    saving: boolean
    generating: boolean
    error: string
    ordersError: string
  }
  interface DraftState {
    id?: string
    projectName: string
    drawingName: string
    projectId: string | null
    customerId: string | null
    categoryId: string | null
    status: 'draft' | 'generated'
    confidence: number
    warnings: string[]
    items: AccessoryProcessingItem[]
  }
  const workspace = reactive<WorkspaceState>({
    tenantId: effectiveTenantId.value ?? '',
    sourceUrl: '',
    sourcePath: '',
    sourceName: '',
    groupId: crypto.randomUUID(),
    pages: [],
    sketchUrls: [],
    lists: [],
    recognitions: [],
    projects: [],
    customers: [],
    categories: [],
    orders: [],
    loading: false,
    recognitionsLoading: false,
    recognitionsError: '',
    openingRecognitionId: '',
    projectsLoading: false,
    ordersLoading: false,
    recognizing: false,
    recognitionError: '',
    saving: false,
    generating: false,
    error: '',
    ordersError: ''
  })
  const draft = reactive<DraftState>({
    id: undefined,
    projectName: '',
    drawingName: '',
    projectId: null,
    customerId: null,
    categoryId: null,
    status: 'draft',
    confidence: 0,
    warnings: [],
    items: []
  })
  const editingIndex = ref<number | null>(null)
  const expandedRowKeys = ref<string[]>([])
  const rowGroups = computed(() => {
    const groups = new Map<
      string,
      {
        key: string
        rowNo: number
        hasWarning: boolean
        entries: { item: AccessoryProcessingItem; index: number }[]
      }
    >()
    draft.items.forEach((item, index) => {
      const key = `${item.sketch?.page ?? 0}:${item.rowNo}`
      const group = groups.get(key) ?? {
        key,
        rowNo: item.rowNo,
        hasWarning: draft.warnings.some((warning) =>
          warning.replaceAll(' ', '').includes(`第${item.rowNo}行`)
        ),
        entries: []
      }
      group.entries.push({ item, index })
      groups.set(key, group)
    })
    return [...groups.values()].map((group) => ({
      ...group,
      lengthSummary: group.entries.map(({ item }) => `${item.lengthM.toFixed(3)} m`).join(' / ')
    }))
  })
  const activeTenantName = computed(
    () =>
      tenantOptions.value.find((tenant) => tenant.id === workspace.tenantId)?.tenantName ||
      '当前租户'
  )
  const orderCards = computed(() =>
    workspace.orders.map((order) => {
      const index = draft.items.findIndex((item) => item.id === order.itemId)
      return {
        order,
        item: index >= 0 ? draft.items[index] : null,
        sketchUrl: index >= 0 ? workspace.sketchUrls[index] : '',
        materialCode: `ACC-${order.itemId.replaceAll('-', '').toUpperCase()}`
      }
    })
  )

  function downloadTemplate(): void {
    const link = document.createElement('a')
    link.href = templateUrl
    link.download = '配件加工清单模板.docx'
    link.click()
  }

  function resetUpload(): void {
    editingIndex.value = null
    Object.assign(workspace, {
      recognitionError: '',
      sourceUrl: '',
      sourcePath: '',
      sourceName: '',
      groupId: crypto.randomUUID(),
      pages: [],
      sketchUrls: []
    })
    Object.assign(draft, {
      id: undefined,
      projectName: '',
      drawingName: '',
      projectId: null,
      customerId: null,
      categoryId: null,
      status: 'draft',
      confidence: 0,
      warnings: [],
      items: []
    })
    void loadProjects()
  }

  async function uploadSource(file: File): Promise<Api.DataCenter.Resources.ResourceListItem[]> {
    if (!workspace.tenantId) throw new Error('请先选择目标租户')
    const pages = await rasterizeProcessingList(file)
    const groupId = crypto.randomUUID()
    const resources = await uploadAccessoryFile(
      workspace.tenantId,
      groupId,
      'source',
      file,
      file.name
    )
    workspace.groupId = groupId
    workspace.pages = pages
    return resources
  }

  function onSourceUploaded(resources: Api.DataCenter.Resources.ResourceListItem[]): void {
    const resource = resources[0]
    if (!resource?.storagePath) return
    editingIndex.value = null
    Object.assign(workspace, {
      recognitionError: '',
      sourcePath: resource.storagePath,
      sourceName: resource.originName || '加工清单',
      sketchUrls: []
    })
    Object.assign(draft, {
      id: undefined,
      status: 'draft',
      projectName: '',
      drawingName: '',
      projectId: null,
      customerId: null,
      categoryId: null,
      items: [],
      warnings: []
    })
  }

  async function recognize(): Promise<void> {
    if (!workspace.pages.length || !workspace.tenantId) return
    workspace.recognizing = true
    workspace.recognitionError = ''
    try {
      const urls: string[] = []
      for (const [index, page] of workspace.pages.entries()) {
        const blob = await (await fetch(page.dataUrl)).blob()
        const [resource] = await uploadAccessoryFile(
          workspace.tenantId,
          workspace.groupId,
          'page',
          blob,
          `page-${index + 1}.png`
        )
        if (!resource?.url) throw new Error('页面图片上传失败')
        urls.push(resource.url)
      }
      const result = await recognizeAccessoryPages(urls)
      const items: AccessoryProcessingItem[] = []
      const sketchUrls: string[] = []
      for (const [index, item] of result.items.entries()) {
        let sketchPath: string | null = null
        let sketchUrl = ''
        const page = item.sketch ? workspace.pages[item.sketch.page - 1] : undefined
        if (page && item.sketch) {
          try {
            const blob = await cropSketch(page, item.sketch)
            const [resource] = await uploadAccessoryFile(
              workspace.tenantId,
              workspace.groupId,
              'sketch',
              blob,
              `sketch-${index + 1}.png`
            )
            sketchPath = resource?.storagePath || null
            sketchUrl = resource?.url || ''
          } catch {
            result.warnings.push(`第 ${item.rowNo} 行草图裁剪失败，请补传`)
          }
        }
        items.push({ ...item, sketchPath })
        sketchUrls.push(sketchUrl)
      }
      Object.assign(draft, {
        id: undefined,
        projectName: result.projectName,
        drawingName: result.drawingName,
        projectId: null,
        customerId: null,
        categoryId: null,
        status: 'draft',
        confidence: result.confidence,
        warnings: result.warnings,
        items
      })
      workspace.sketchUrls = sketchUrls
      editingIndex.value = null
      await loadRecognitions()
      ElMessage.success(`已识别 ${items.length} 个独立加工件，识别记录已留存`)
      await nextTick()
      document
        .getElementById('accessory-recognition-result')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (error) {
      const message = getFriendlySupabaseErrorMessage(error, '加工清单识别失败，请重试')
      if (draft.items.length) {
        ElMessage.error(message)
      } else {
        workspace.recognitionError = message
        await nextTick()
        document
          .getElementById('accessory-recognition-result')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } finally {
      workspace.recognizing = false
    }
  }

  async function uploadSketch(
    file: File,
    index: number
  ): Promise<Api.DataCenter.Resources.ResourceListItem[]> {
    return uploadAccessoryFile(
      workspace.tenantId,
      workspace.groupId,
      'sketch',
      file,
      `sketch-${index + 1}.${file.name.split('.').pop() || 'png'}`
    )
  }

  function onSketchUploaded(
    resources: Api.DataCenter.Resources.ResourceListItem[],
    index: number
  ): void {
    const item = draft.items[index]
    const resource = resources[0]
    if (item && resource?.storagePath) {
      item.sketchPath = resource.storagePath
      workspace.sketchUrls[index] = resource.url || ''
    }
  }

  function onProjectSelected(id: string | null): void {
    const project = workspace.projects.find((item) => item.id === id)
    if (project) draft.projectName = project.projectName
  }

  async function saveDraft(): Promise<boolean> {
    if (
      !workspace.tenantId ||
      !workspace.sourcePath ||
      !draft.projectName.trim() ||
      !draft.items.length
    ) {
      ElMessage.warning('请先上传清单，填写项目名称并确认加工件')
      return false
    }
    if (draft.items.some((item) => !item.name.trim() || item.lengthM <= 0 || item.quantity < 1)) {
      ElMessage.warning('请检查每个加工件的名称、长度和数量')
      return false
    }
    workspace.saving = true
    try {
      draft.id = await saveAccessoryDraft({
        id: draft.id,
        tenantId: workspace.tenantId,
        sourcePath: workspace.sourcePath,
        sourceName: workspace.sourceName,
        projectName: draft.projectName.trim(),
        drawingName: draft.drawingName.trim(),
        projectId: draft.projectId,
        customerId: draft.customerId,
        categoryId: draft.categoryId,
        confidence: draft.confidence,
        warnings: draft.warnings,
        items: draft.items
      })
      ElMessage.success('加工清单草稿已保存')
      await loadLists()
      return true
    } catch (error) {
      ElMessage.error(getFriendlySupabaseErrorMessage(error, '加工清单保存失败，请重试'))
      return false
    } finally {
      workspace.saving = false
    }
  }

  async function generate(): Promise<void> {
    if (!isPlatformSuper.value) return
    if (draft.items.some((item) => !item.sketchPath)) {
      ElMessage.warning('请先为每个加工件补齐独立草图并保存草稿')
      return
    }
    if (!draft.categoryId) {
      ElMessage.warning('请先选择加工件物料分类')
      return
    }
    try {
      await confirmAction(
        `将生成 ${draft.items.length} 个物料和生产加工单，并建立项目 BOM。请确认已完成校对。`,
        '生成业务单据',
        { confirmButtonText: '确认生成', cancelButtonText: '继续校对' }
      )
    } catch {
      return
    }
    workspace.generating = true
    try {
      if (!(await saveDraft()) || !draft.id) return
      await finalizeAccessoryList(draft.id)
      draft.status = 'generated'
      ElMessage.success('项目物料、BOM 和生产加工单已生成')
      await Promise.all([loadLists(), loadOrders(), loadProjects()])
      const generated = workspace.lists.find((list) => list.id === draft.id)
      if (generated) {
        draft.projectId = generated.projectId
        draft.items = generated.items
      }
    } catch (error) {
      ElMessage.error(getFriendlySupabaseErrorMessage(error, '生成失败，请检查清单后重试'))
    } finally {
      workspace.generating = false
    }
  }

  async function loadLists(): Promise<void> {
    workspace.loading = true
    workspace.error = ''
    try {
      workspace.lists = await fetchAccessoryLists(effectiveTenantId.value)
    } catch (error) {
      workspace.error = getFriendlySupabaseErrorMessage(error, '清单加载失败，请重试')
    } finally {
      workspace.loading = false
    }
  }

  async function loadRecognitions(): Promise<void> {
    workspace.recognitionsLoading = true
    workspace.recognitionsError = ''
    const tenantId = effectiveTenantId.value
    try {
      const records = await fetchAccessoryRecognitions(tenantId)
      if (tenantId === effectiveTenantId.value) workspace.recognitions = records
    } catch (error) {
      workspace.recognitionsError = getFriendlySupabaseErrorMessage(
        error,
        '识别记录加载失败，请重试'
      )
    } finally {
      workspace.recognitionsLoading = false
    }
  }

  async function openRecognition(record: AccessoryRecognitionRecord): Promise<void> {
    if (workspace.openingRecognitionId) return
    workspace.openingRecognitionId = record.id
    try {
      let files: Awaited<ReturnType<typeof restoreAccessoryRecognitionFiles>> = {
        sourcePath: '',
        sourceUrl: '',
        sketchPaths: record.items.map(() => null),
        sketchUrls: record.items.map(() => '')
      }
      try {
        files = await restoreAccessoryRecognitionFiles(record)
      } catch (error) {
        ElMessage.warning(
          getFriendlySupabaseErrorMessage(error, '已打开识别文字，原件和草图暂时无法预览')
        )
      }
      workspace.tenantId = record.tenantId
      Object.assign(workspace, {
        recognitionError: '',
        sourcePath: files.sourcePath,
        sourceUrl: files.sourceUrl,
        sourceName: files.sourcePath
          ? `识别原件.${files.sourcePath.split('.').pop() || 'pdf'}`
          : '识别原件',
        groupId: crypto.randomUUID(),
        pages: [],
        sketchUrls: files.sketchUrls,
        orders: []
      })
      Object.assign(draft, {
        id: undefined,
        projectName: record.projectName,
        drawingName: record.drawingName,
        projectId: null,
        customerId: null,
        categoryId: null,
        status: 'draft',
        confidence: record.confidence,
        warnings: record.warnings,
        items: record.items.map((item, index) => ({
          ...item,
          sketchPath: files.sketchPaths[index]
        }))
      })
      editingIndex.value = null
      await Promise.all([loadProjects(), nextTick()])
      document
        .getElementById('accessory-recognition-result')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (error) {
      ElMessage.error(getFriendlySupabaseErrorMessage(error, '识别记录打开失败，请重试'))
    } finally {
      workspace.openingRecognitionId = ''
    }
  }

  async function loadProjects(): Promise<void> {
    workspace.projects = []
    if (!workspace.tenantId) return
    workspace.projectsLoading = true
    try {
      workspace.projects = await fetchAccessoryProjects(workspace.tenantId)
      if (isPlatformSuper.value) {
        const [customers, categories] = await Promise.all([
          fetchAccessoryCustomers(workspace.tenantId),
          fetchAccessoryCategories(workspace.tenantId)
        ])
        workspace.customers = customers
        workspace.categories = categories
      }
    } catch (error) {
      ElMessage.error(getFriendlySupabaseErrorMessage(error, '项目列表加载失败，请重试'))
    } finally {
      workspace.projectsLoading = false
    }
  }

  async function loadOrders(): Promise<void> {
    if (!draft.id) return
    workspace.ordersLoading = true
    workspace.ordersError = ''
    try {
      workspace.orders = await fetchAccessoryWorkOrders(draft.id)
    } catch (error) {
      workspace.ordersError = getFriendlySupabaseErrorMessage(error, '加工单加载失败，请重试')
    } finally {
      workspace.ordersLoading = false
    }
  }

  async function openList(list: AccessoryProcessingList): Promise<void> {
    editingIndex.value = null
    workspace.tenantId = list.tenantId
    Object.assign(workspace, {
      recognitionError: '',
      sourcePath: list.sourcePath,
      sourceName: list.sourceName,
      groupId: crypto.randomUUID(),
      pages: [],
      orders: []
    })
    Object.assign(draft, {
      id: list.id,
      projectName: list.projectName,
      drawingName: list.drawingName,
      projectId: list.projectId,
      customerId: list.customerId,
      categoryId: list.categoryId,
      status: list.status,
      confidence: list.confidence,
      warnings: list.warnings || [],
      items: list.items || []
    })
    try {
      workspace.sourceUrl = await signAccessoryPath(list.sourcePath)
      workspace.sketchUrls = await Promise.all(
        draft.items.map((item) =>
          item.sketchPath ? signAccessoryPath(item.sketchPath) : Promise.resolve('')
        )
      )
    } catch (error) {
      ElMessage.warning(
        getFriendlySupabaseErrorMessage(error, '部分文件暂时无法预览，请刷新后重试')
      )
    }
    await Promise.all([
      loadProjects(),
      list.status === 'generated' ? loadOrders() : Promise.resolve()
    ])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  watch(effectiveTenantId, (tenantId) => {
    workspace.tenantId = tenantId ?? ''
    resetUpload()
    void Promise.all([loadLists(), loadRecognitions()])
  })
  watch(
    () => draft.items,
    () => {
      expandedRowKeys.value = rowGroups.value
        .filter((group) => group.hasWarning)
        .map((group) => group.key)
    }
  )
  onMounted(() => {
    void Promise.all([loadLists(), loadProjects(), loadRecognitions()])
  })
</script>

<style scoped lang="scss">
  .accessory-result-collapse {
    border: 0;

    :deep(.el-collapse-item) {
      margin-bottom: var(--art-space-2);
      overflow: hidden;
      border: 1px solid var(--el-border-color-light);
      border-radius: var(--custom-radius);
    }

    :deep(.el-collapse-item__header) {
      height: auto;
      min-height: 52px;
      padding: 8px 16px;
      line-height: 1.5;
      background: var(--el-fill-color-light);
      border-bottom: 0;
    }

    :deep(.el-collapse-item__header:focus-visible) {
      outline: 2px solid var(--theme-color);
      outline-offset: -2px;
    }

    :deep(.el-collapse-item__arrow) {
      flex: 0 0 auto;
      margin-left: 12px;
    }

    :deep(.el-collapse-item__wrap) {
      border-top: 1px solid var(--el-border-color-lighter);
      border-bottom: 0;
    }

    :deep(.el-collapse-item__content) {
      padding-bottom: 0;
    }
  }
</style>
