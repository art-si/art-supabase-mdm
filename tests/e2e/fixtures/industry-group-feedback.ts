import { createApp, defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { setupGlobDirectives } from '@/directives'
import language from '@/locales'
import { store } from '@/store'
import IndustryGroupDialog, {
  type IndustryGroupDialogOpenData
} from '@mdm/views/engineering/component-type/modules/industry-group-dialog.vue'
import '@styles/core/tailwind.css'
import '@styles/index.scss'

const openData: IndustryGroupDialogOpenData = {
  groups: [],
  tenantId: '00000000-0000-0000-0000-000000000001',
  tenantOptions: [{ label: '测试租户', value: '00000000-0000-0000-0000-000000000001' }]
}

const Preview = defineComponent({
  setup() {
    const dialog = ref<{ handleOpen: (data: IndustryGroupDialogOpenData) => Promise<void> }>()
    return () =>
      h('main', { style: 'padding: 24px' }, [
        h(
          'button',
          {
            type: 'button',
            onClick: () => dialog.value?.handleOpen(openData)
          },
          '打开行业分组弹窗'
        ),
        h(IndustryGroupDialog, { ref: dialog })
      ])
  }
})

const app = createApp(Preview)
app.use(store)
app.use(
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }]
  })
)
app.use(language)
setupGlobDirectives(app)
app.mount('#industry-group-feedback-preview')
