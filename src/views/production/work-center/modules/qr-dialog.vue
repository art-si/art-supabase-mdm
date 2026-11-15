<template>
  <ArtDialog ref="dialogRef" size="lg" @close="clearRows"
    ><div ref="labelsRef" class="center-labels"
      ><div v-for="row in rows" :key="row.id" class="center-labels__item"
        ><QrcodeVue
          :value="row.qrToken"
          :size="144"
          level="M"
          render-as="canvas"
          :margin="4"
        /><strong>{{ row.code }}</strong
        ><span>{{ row.name }}</span></div
      ></div
    ></ArtDialog
  >
</template>
<script setup lang="ts">
  import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
  import QrcodeVue from 'qrcode.vue'
  import { ElMessage } from 'element-plus'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { createTenantScopeReadGuard, TenantScopeChangedError } from '@/utils/tenant-scope-context'
  import type { WorkCenter } from '@mdm/api'
  const dialogRef = ref<ArtDialogExpose>()
  const labelsRef = ref<HTMLElement>()
  const rows = shallowRef<WorkCenter[]>([])
  const tenantScope = useTenantScopeStore()
  function clearRows() {
    rows.value = []
  }
  watch(
    [() => tenantScope.effectiveTenantId, () => tenantScope.revision],
    () => {
      if (!rows.value.length) return
      clearRows()
      void dialogRef.value?.handleClose(true)
    },
    { flush: 'sync' }
  )
  onBeforeUnmount(clearRows)
  async function handleOpen(data: WorkCenter[]) {
    const assertScope = createTenantScopeReadGuard()
    rows.value = data
    await dialogRef.value?.handleOpen(undefined, {
      title: `工作中心二维码 · ${data.length} 个`,
      confirmText: '下载 Excel 标签',
      onConfirm: async () => {
        try {
          assertScope()
          const [{ default: ExcelJS }, { default: saveAs }] = await Promise.all([
            import('exceljs'),
            import('file-saver')
          ])
          assertScope()
          if (rows.value !== data) return false
          const workbook = new ExcelJS.Workbook()
          const sheet = workbook.addWorksheet('工作中心二维码')
          sheet.columns = [
            { header: '工作中心', key: 'code', width: 24 },
            { header: '名称', key: 'name', width: 30 },
            { header: '二维码', key: 'qr', width: 26 }
          ]
          const canvases = labelsRef.value?.querySelectorAll('canvas')
          if (!canvases || canvases.length !== data.length) throw new Error('二维码未加载')
          data.forEach((row, index) => {
            sheet.addRow({ code: row.code, name: row.name })
            sheet.getRow(index + 2).height = 122
            const image = workbook.addImage({
              base64: canvases[index].toDataURL('image/png'),
              extension: 'png'
            })
            sheet.addImage(image, {
              tl: { col: 2, row: index + 1 },
              ext: { width: 150, height: 150 }
            })
          })
          const bytes = await workbook.xlsx.writeBuffer()
          assertScope()
          if (rows.value !== data) return false
          saveAs(
            new Blob([bytes], {
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }),
            '工作中心二维码.xlsx'
          )
        } catch (error) {
          if (error instanceof TenantScopeChangedError || rows.value !== data) return false
          ElMessage.error('二维码导出失败，请重试')
          return false
        }
      }
    })
  }
  defineExpose({ handleOpen })
</script>
<style scoped lang="scss">
  .center-labels {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 24px;

    &__item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      min-width: 0;

      strong,
      span {
        max-width: 100%;
        overflow-wrap: anywhere;
      }

      span {
        color: var(--el-text-color-secondary);
      }
    }
  }
</style>
