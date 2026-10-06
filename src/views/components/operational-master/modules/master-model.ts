import { cloneDeep, pick } from 'lodash-es'
import type {
  OperationalMasterInput,
  OperationalMasterRecord
} from '../../../../api/modules/operational-master.types'
import type { OperationalMasterConfig } from './master-config'

// Defaults describe business field semantics, independently of the control used to edit them.
const fieldDefaults: Required<Omit<OperationalMasterInput, 'tenantId'>> = {
  code: '',
  name: '',
  customerCode: '',
  customerName: '',
  projectCode: '',
  projectName: '',
  controlCode: '',
  controlCodeName: '',
  workstationCode: '',
  workstationName: '',
  groupId: null,
  customerId: null,
  menuId: null,
  industry: null,
  customerLevel: null,
  region: null,
  addressDetail: null,
  contactName: null,
  contactPhone: null,
  contactDepartment: null,
  contactPosition: null,
  contactEmail: null,
  contactQq: null,
  invoiceTitle: null,
  taxNo: null,
  bankName: null,
  bankAccount: null,
  projectMode: null,
  projectStage: null,
  projectStatus: null,
  ownerId: null,
  salespersonId: null,
  source: null,
  purpose: null,
  activityType: null,
  activityTypes: [],
  isDefault: false,
  planExpression: null,
  reportExpression: null,
  formulaExpression: null,
  formulaTranslation: null,
  formulaTokens: [],
  description: null,
  participatesScheduling: false,
  processingMode: null,
  reportMode: null,
  timeUnitId: null,
  inspectionMode: null,
  sequenceControl: null,
  reworkMode: null,
  mnemonic: null,
  pricingType: null,
  departmentId: null,
  workCenterIds: [],
  price: 0,
  pricingUnitId: null,
  processingDefectReasons: [],
  materialDefectReasons: [],
  workCenterId: null,
  responsiblePersonId: null,
  andonSimNo: null,
  enabled: true,
  remark: ''
}

interface MasterModelContext {
  config: Pick<OperationalMasterConfig, 'kind' | 'fields'>
  tenantId: string
  row?: OperationalMasterRecord
  initialGroupId?: string
  copy?: boolean
}

export function createOperationalMasterModel(data: MasterModelContext): OperationalMasterRecord {
  const defaults = cloneDeep(fieldDefaults)
  const model: OperationalMasterRecord = {
    ...pick(
      defaults,
      data.config.fields.map((field) => field.key)
    ),
    id: '',
    tenantId: data.row?.tenantId || data.tenantId,
    enabled: true,
    remark: ''
  }
  if (data.row) Object.assign(model, cloneDeep(data.row))
  else if (data.config.kind === 'operation' && data.initialGroupId) {
    model.groupId = data.initialGroupId
  }
  if (data.copy) {
    model.id = ''
    Object.assign(
      model,
      pick(
        defaults,
        data.config.fields.filter((field) => field.systemGenerated).map((field) => field.key)
      )
    )
  }
  return model
}
