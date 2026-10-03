<template>
  <ArtDialog ref="dialogRef" size="sm">
    <div class="governance-action-dialog">
      <div :class="['governance-action-dialog__summary', `is-${state.tone}`]">
        <span><ArtSvgIcon :icon="state.icon" /></span>
        <div>
          <strong>{{ state.title }}</strong>
          <small>{{ state.subtitle }}</small>
        </div>
      </div>
      <ArtForm
        ref="formRef"
        v-model="form"
        :items="formItems"
        :rules="formRules"
        :show-reset="false"
        :show-submit="false"
        label-position="top"
      />
      <p class="governance-action-dialog__audit">
        <ArtSvgIcon
          icon="ri:shield-check-line"
        />本次操作人、状态变化、说明与快照将写入不可变审计轨迹。
      </p>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import {
    replayMdmOutboxDelivery,
    reviewMdmMatchCandidate,
    transitionMdmChangeRequest,
    transitionMdmQualityIssue,
    type MdmChangeRequest,
    type MdmMatchCandidate,
    type MdmOutboxDelivery,
    type MdmQualityIssue
  } from '@mdm/api'
  import { getGovernanceEventTypeLabel } from '../governance-labels'

  defineOptions({ name: 'MdmGovernanceActionDialog' })

  type QualityAction = 'start' | 'submit_resolution' | 'verify' | 'waive' | 'reopen'
  type ChangeAction = 'submit' | 'cancel' | 'approve' | 'reject' | 'publish'
  type ActionContext =
    | { kind: 'quality'; action: QualityAction; row: MdmQualityIssue }
    | { kind: 'change'; action: ChangeAction; row: MdmChangeRequest }
    | { kind: 'match'; action: 'accept' | 'reject'; row: MdmMatchCandidate }
    | { kind: 'replay'; action: 'replay'; row: MdmOutboxDelivery }

  interface FormExpose {
    validate: () => Promise<boolean>
  }

  const emit = defineEmits<{ (event: 'success'): void }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<FormExpose>()
  const context = shallowRef<ActionContext>()
  const form = reactive({ comment: '', winnerRecordId: '' })
  const state = reactive({
    title: '',
    subtitle: '',
    icon: 'ri:shield-check-line',
    tone: 'primary',
    confirmText: '确认执行',
    requireComment: false
  })

  const formItems = computed<FormItem[]>(() => [
    {
      label: '黄金记录胜出来源',
      key: 'winnerRecordId',
      type: 'radioGroup',
      span: 24,
      hidden: context.value?.kind !== 'match' || context.value.action !== 'accept',
      options:
        context.value?.kind === 'match'
          ? [
              {
                label: `左侧记录 · ${context.value.row.leftRecordId}`,
                value: context.value.row.leftRecordId
              },
              {
                label: `右侧记录 · ${context.value.row.rightRecordId}`,
                value: context.value.row.rightRecordId
              }
            ]
          : []
    },
    {
      label: state.requireComment ? '处理说明' : '补充说明（选填）',
      key: 'comment',
      type: 'textarea',
      span: 24,
      props: {
        maxlength: 500,
        placeholder: state.requireComment ? '请说明判断依据和处理原因' : '可补充处理说明'
      }
    }
  ])
  const formRules = computed<FormRules>(() => ({
    winnerRecordId:
      context.value?.kind === 'match' && context.value.action === 'accept'
        ? [{ required: true, message: '请选择胜出来源记录', trigger: 'change' }]
        : [],
    comment: state.requireComment
      ? [
          { required: true, message: '请填写处理说明', trigger: 'blur' },
          { min: 2, message: '处理说明至少 2 个字符', trigger: 'blur' }
        ]
      : []
  }))

  const qualityCopy: Record<QualityAction, Partial<typeof state>> = {
    start: { title: '开始整改', icon: 'ri:play-circle-line', confirmText: '开始整改' },
    submit_resolution: {
      title: '提交整改结果',
      icon: 'ri:send-plane-line',
      confirmText: '提交复核',
      requireComment: true
    },
    verify: { title: '独立复核通过', icon: 'ri:check-double-line', confirmText: '确认复核' },
    waive: {
      title: '豁免质量问题',
      icon: 'ri:alarm-warning-line',
      tone: 'warning',
      confirmText: '确认豁免',
      requireComment: true
    },
    reopen: {
      title: '重新打开问题',
      icon: 'ri:restart-line',
      tone: 'warning',
      confirmText: '重新打开',
      requireComment: true
    }
  }
  const changeCopy: Record<ChangeAction, Partial<typeof state>> = {
    submit: { title: '提交变更审核', icon: 'ri:send-plane-line', confirmText: '提交审核' },
    cancel: {
      title: '撤回变更申请',
      icon: 'ri:arrow-go-back-line',
      tone: 'warning',
      confirmText: '确认撤回',
      requireComment: true
    },
    approve: { title: '审核通过变更', icon: 'ri:check-double-line', confirmText: '审核通过' },
    reject: {
      title: '驳回变更申请',
      icon: 'ri:close-circle-line',
      tone: 'danger',
      confirmText: '确认驳回',
      requireComment: true
    },
    publish: { title: '发布主数据变更', icon: 'ri:broadcast-line', confirmText: '确认发布' }
  }

  async function submit(): Promise<boolean> {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '治理操作校验未完成，请稍后重试', 'warning')
      return false
    }
    const current = context.value
    if (!current) {
      ElMessage.warning('操作上下文已失效，请关闭后重新打开')
      return false
    }
    try {
      if (current.kind === 'quality') {
        await transitionMdmQualityIssue(current.row.id, current.action, form.comment)
      } else if (current.kind === 'change') {
        await transitionMdmChangeRequest(current.row.id, current.action, form.comment)
      } else if (current.kind === 'match') {
        await reviewMdmMatchCandidate(
          current.row.id,
          current.action,
          current.action === 'accept' ? form.winnerRecordId : null,
          form.comment.trim()
        )
      } else {
        await replayMdmOutboxDelivery(current.row.id, form.comment.trim())
      }
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '治理操作未完成，请刷新记录状态后重试')
      return false
    }
  }

  async function handleOpen(next: ActionContext): Promise<void> {
    context.value = next
    form.comment = ''
    form.winnerRecordId = next.kind === 'match' ? next.row.leftRecordId : ''
    Object.assign(state, {
      title: '',
      subtitle: '',
      icon: 'ri:shield-check-line',
      tone: 'primary',
      confirmText: '确认执行',
      requireComment: false
    })
    if (next.kind === 'quality') {
      Object.assign(state, qualityCopy[next.action], {
        subtitle: `${next.row.sourceName} · ${next.row.sourceCode || '无编码'}`
      })
    } else if (next.kind === 'change') {
      Object.assign(state, changeCopy[next.action], {
        subtitle: `${next.row.requestNo} · ${next.row.title}`
      })
    } else if (next.kind === 'match') {
      Object.assign(state, {
        title: next.action === 'accept' ? '确认匹配并生成黄金记录' : '驳回候选匹配',
        subtitle: `匹配置信度 ${Math.round(next.row.matchScore * 100)}%`,
        icon: next.action === 'accept' ? 'ri:links-line' : 'ri:link-unlink-m',
        tone: next.action === 'accept' ? 'primary' : 'danger',
        confirmText: next.action === 'accept' ? '确认合并' : '确认驳回',
        requireComment: true
      })
    } else {
      Object.assign(state, {
        title: '重放死信事件',
        subtitle: `${next.row.consumer?.consumerName || '未命名消费者'} · ${getGovernanceEventTypeLabel(next.row.event?.eventType)}`,
        icon: 'ri:restart-line',
        tone: 'warning',
        confirmText: '进入重试队列',
        requireComment: true
      })
    }
    await dialogRef.value?.handleOpen(undefined, {
      title: state.title,
      confirmText: state.confirmText,
      onConfirm: submit
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .governance-action-dialog {
    display: grid;
    gap: 16px;

    &__summary {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      padding: 14px;
      background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
      border: 1px solid var(--el-color-primary-light-7);
      border-radius: var(--el-border-radius-base);

      > span {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        font-size: 19px;
        color: var(--el-color-primary);
        background: var(--el-bg-color);
        border-radius: 50%;
      }

      div {
        display: grid;
        gap: 3px;
        min-width: 0;
      }

      strong {
        font-size: 13px;
      }

      small {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: var(--el-text-color-secondary);
        white-space: nowrap;
      }

      &.is-warning {
        background: color-mix(in srgb, var(--el-color-warning) 8%, var(--el-bg-color));
        border-color: var(--el-color-warning-light-7);

        > span {
          color: var(--el-color-warning);
        }
      }

      &.is-danger {
        background: color-mix(in srgb, var(--el-color-danger) 7%, var(--el-bg-color));
        border-color: var(--el-color-danger-light-7);

        > span {
          color: var(--el-color-danger);
        }
      }
    }

    &__audit {
      display: flex;
      gap: 7px;
      align-items: flex-start;
      margin: 0;
      font-size: 11px;
      line-height: 1.6;
      color: var(--el-text-color-secondary);
    }
  }
</style>
