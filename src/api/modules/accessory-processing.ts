import { useSupabase } from '@/hooks'
import { createFriendlySupabaseFunctionError } from '@/utils/supabase/error'

const { supabase, responseHandle } = useSupabase()
const bucket = 'mdm-accessory-processing'

export interface AccessorySketchBounds {
  page: number
  x: number
  y: number
  width: number
  height: number
}

export interface AccessoryProcessingItem {
  id?: string
  lineNo?: number
  rowNo: number
  name: string
  widthMm: number | null
  lengthM: number
  quantity: number
  materialColor: string
  remark: string
  sketch: AccessorySketchBounds | null
  sketchPath?: string | null
  materialId?: string | null
}

export interface AccessoryProcessingList {
  id: string
  tenantId: string
  sourcePath: string
  sourceName: string
  projectName: string
  drawingName: string
  projectId: string | null
  customerId: string | null
  categoryId: string | null
  status: 'draft' | 'generated'
  confidence: number
  warnings: string[]
  createTime: string
  items: AccessoryProcessingItem[]
}

export interface AccessoryOcrResponse {
  rawText: string
  projectName: string
  drawingName: string
  confidence: number
  warnings: string[]
  items: AccessoryProcessingItem[]
  artifactId: string
}

export interface AccessoryRecognitionRecord {
  id: string
  tenantId: string
  createTime: string
  projectName: string
  drawingName: string
  confidence: number
  warnings: string[]
  items: AccessoryProcessingItem[]
  imageUrls: string[]
}

interface RecognitionRow {
  id: string
  tenantId: string
  createTime: string
  proposedPayload: unknown
  metadata: unknown
  confidence: number | null
  warnings: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRecognitionItem(value: unknown): AccessoryProcessingItem | null {
  if (!isRecord(value)) return null
  if (
    typeof value.rowNo !== 'number' ||
    typeof value.name !== 'string' ||
    typeof value.lengthM !== 'number' ||
    typeof value.quantity !== 'number'
  )
    return null
  const rawSketch = isRecord(value.sketch) ? value.sketch : null
  const sketch: AccessorySketchBounds | null =
    rawSketch &&
    typeof rawSketch.page === 'number' &&
    typeof rawSketch.x === 'number' &&
    typeof rawSketch.y === 'number' &&
    typeof rawSketch.width === 'number' &&
    typeof rawSketch.height === 'number'
      ? {
          page: rawSketch.page,
          x: rawSketch.x,
          y: rawSketch.y,
          width: rawSketch.width,
          height: rawSketch.height
        }
      : null
  return {
    rowNo: value.rowNo,
    name: value.name,
    widthMm: typeof value.widthMm === 'number' ? value.widthMm : null,
    lengthM: value.lengthM,
    quantity: value.quantity,
    materialColor: typeof value.materialColor === 'string' ? value.materialColor : '',
    remark: typeof value.remark === 'string' ? value.remark : '',
    sketch,
    sketchPath: null
  }
}

export async function fetchAccessoryRecognitions(
  tenantId: string | null
): Promise<AccessoryRecognitionRecord[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user)
    throw new Error('登录状态已失效，请重新登录', { cause: authError })
  let query = supabase
    .from('ai_artifact_review')
    .select(
      'id,tenantId:tenant_id,createTime:create_time,proposedPayload:proposed_payload,metadata,confidence,warnings'
    )
    .eq('feature', 'accessory_processing_ocr')
    .eq('auth_user_id', authData.user.id)
    .order('create_time', { ascending: false })
    .limit(50)
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data } = await responseHandle<RecognitionRow[]>(() => query, {
    breakReturn: true,
    showErrorMessage: false,
    errorMessage: '识别记录加载失败，请重试'
  })
  return (data ?? []).map((row) => {
    const payload = isRecord(row.proposedPayload) ? row.proposedPayload : {}
    const metadata = isRecord(row.metadata) ? row.metadata : {}
    return {
      id: row.id,
      tenantId: row.tenantId,
      createTime: row.createTime,
      projectName: typeof payload.projectName === 'string' ? payload.projectName : '',
      drawingName: typeof payload.drawingName === 'string' ? payload.drawingName : '',
      confidence: typeof row.confidence === 'number' ? row.confidence : 0,
      warnings: Array.isArray(row.warnings)
        ? row.warnings.filter((warning): warning is string => typeof warning === 'string')
        : [],
      items: Array.isArray(payload.items)
        ? payload.items
            .map(parseRecognitionItem)
            .filter((item): item is AccessoryProcessingItem => Boolean(item))
        : [],
      imageUrls: Array.isArray(metadata.imageUrls)
        ? metadata.imageUrls.filter((url): url is string => typeof url === 'string')
        : []
    }
  })
}

export async function restoreAccessoryRecognitionFiles(
  record: AccessoryRecognitionRecord
): Promise<{
  sourcePath: string
  sourceUrl: string
  sketchPaths: (string | null)[]
  sketchUrls: string[]
}> {
  const pageUrl = record.imageUrls[0]
  if (!pageUrl) throw new Error('该识别记录缺少原件索引，请重新上传清单')
  let pathname: string
  try {
    pathname = new URL(pageUrl).pathname
  } catch {
    throw new Error('该识别记录的原件索引无效，请重新上传清单')
  }
  const match =
    /^\/storage\/v1\/object\/sign\/mdm-accessory-processing\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/page\//i.exec(
      pathname
    )
  if (!match || match[1].toLowerCase() !== record.tenantId.toLowerCase()) {
    throw new Error('该识别记录的原件索引无效，请重新上传清单')
  }
  const prefix = `${match[1]}/${match[2]}`
  const [sourceResult, sketchResult] = await Promise.all([
    supabase.storage.from(bucket).list(`${prefix}/source`, { limit: 100 }),
    supabase.storage.from(bucket).list(`${prefix}/sketch`, { limit: 100 })
  ])
  if (sourceResult.error || sketchResult.error) {
    throw new Error('识别原件或草图读取失败，请稍后重试', {
      cause: sourceResult.error || sketchResult.error
    })
  }
  const sourceFile = sourceResult.data?.find((file) => /^[0-9a-f-]{36}-/i.test(file.name))
  const sourcePath = sourceFile ? `${prefix}/source/${sourceFile.name}` : ''
  const sketchPaths = record.items.map((_, index) => {
    const sketchFile = sketchResult.data?.find((file) =>
      new RegExp(`^[0-9a-f-]{36}-sketch-${index + 1}\\.`, 'i').test(file.name)
    )
    return sketchFile ? `${prefix}/sketch/${sketchFile.name}` : null
  })
  const [sourceSigned, ...sketchSigned] = await Promise.all([
    sourcePath ? signAccessoryPath(sourcePath) : Promise.resolve(''),
    ...sketchPaths.map((path) => (path ? signAccessoryPath(path) : Promise.resolve('')))
  ])
  return { sourcePath, sourceUrl: sourceSigned, sketchPaths, sketchUrls: sketchSigned }
}

export interface AccessoryProjectOption {
  id: string
  projectName: string
  projectCode: string
  tenantId: string
}

export interface AccessoryCustomerOption {
  id: string
  customerName: string
}

export interface AccessoryCategoryOption {
  id: string
  categoryName: string
}

export interface AccessoryWorkOrder {
  id: string
  orderNo: string
  itemId: string
  materialId: string
  quantity: number
  lengthM: number
  status: string
}

export async function uploadAccessoryFile(
  tenantId: string,
  groupId: string,
  kind: 'source' | 'page' | 'sketch',
  file: File | Blob,
  filename: string
): Promise<Api.DataCenter.Resources.ResourceListItem[]> {
  const safeName = filename.replace(/[^\w.-]/g, '_').slice(-100)
  const path = `${tenantId}/${groupId}/${kind}/${crypto.randomUUID()}-${safeName}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  })
  if (error) throw new Error('文件上传失败，请稍后重试', { cause: error })
  const url = await signAccessoryPath(path)
  return [{ tenantId, originName: filename, storagePath: path, mimeType: file.type, url }]
}

export async function signAccessoryPath(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600)
  if (error || !data?.signedUrl)
    throw new Error('文件访问地址获取失败，请刷新后重试', { cause: error })
  return data.signedUrl
}

export async function recognizeAccessoryPages(imageUrls: string[]): Promise<AccessoryOcrResponse> {
  const { data, error } = await supabase.functions.invoke<unknown>('ai-accessory-processing-ocr', {
    body: { imageUrls }
  })
  if (error) throw await createFriendlySupabaseFunctionError(error, '加工清单识别失败，请稍后重试')
  if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) {
    throw new Error('识别结果格式不完整，请重新识别')
  }
  return data as AccessoryOcrResponse
}

export async function fetchAccessoryLists(
  tenantId: string | null
): Promise<AccessoryProcessingList[]> {
  let query = supabase
    .from('mdm_accessory_processing_list')
    .select(
      'id,tenantId:tenant_id,sourcePath:source_path,sourceName:source_name,projectName:project_name,drawingName:drawing_name,projectId:project_id,customerId:customer_id,categoryId:category_id,status,confidence,warnings,createTime:create_time,items:mdm_accessory_processing_item(id,lineNo:line_no,rowNo:row_no,name,widthMm:width_mm,lengthM:length_m,quantity,materialColor:material_color,remark,sketch:sketch_bounds,sketchPath:sketch_path,materialId:material_id)'
    )
    .order('create_time', { ascending: false })
    .limit(100)
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data } = await responseHandle<AccessoryProcessingList[]>(() => query, {
    breakReturn: true,
    showErrorMessage: false,
    errorMessage: '配件加工清单加载失败，请重试'
  })
  return (data ?? []).map((list) => ({
    ...list,
    items: [...(list.items ?? [])].sort((a, b) => (a.lineNo ?? 0) - (b.lineNo ?? 0))
  }))
}

export async function fetchAccessoryProjects(tenantId: string): Promise<AccessoryProjectOption[]> {
  const { data } = await responseHandle<AccessoryProjectOption[]>(
    () =>
      supabase
        .from('mdm_project')
        .select('id,tenantId:tenant_id,projectName:project_name,projectCode:project_code')
        .eq('tenant_id', tenantId)
        .order('project_name')
        .limit(300),
    { breakReturn: true, showErrorMessage: false, errorMessage: '项目列表加载失败，请重试' }
  )
  return data ?? []
}

export async function fetchAccessoryCustomers(
  tenantId: string
): Promise<AccessoryCustomerOption[]> {
  const { data } = await responseHandle<AccessoryCustomerOption[]>(
    () =>
      supabase
        .from('mdm_customer')
        .select('id,customerName:customer_name')
        .eq('tenant_id', tenantId)
        .eq('enabled', true)
        .order('customer_name')
        .limit(300),
    { breakReturn: true, showErrorMessage: false, errorMessage: '客户列表加载失败，请重试' }
  )
  return data ?? []
}

export async function fetchAccessoryCategories(
  tenantId: string
): Promise<AccessoryCategoryOption[]> {
  const { data } = await responseHandle<AccessoryCategoryOption[]>(
    () =>
      supabase
        .from('mdm_material_category')
        .select('id,categoryName:category_name')
        .eq('tenant_id', tenantId)
        .eq('status', 'enabled')
        .order('category_name')
        .limit(300),
    { breakReturn: true, showErrorMessage: false, errorMessage: '物料分类加载失败，请重试' }
  )
  return data ?? []
}

export async function saveAccessoryDraft(payload: {
  id?: string
  tenantId: string
  sourcePath: string
  sourceName: string
  projectName: string
  drawingName: string
  projectId: string | null
  customerId: string | null
  categoryId: string | null
  confidence: number
  warnings: string[]
  items: AccessoryProcessingItem[]
}): Promise<string> {
  const { data } = await responseHandle<string>(
    () => supabase.rpc('mdm_save_accessory_processing_draft', { p_payload: payload }),
    {
      breakReturn: true,
      showErrorMessage: false,
      errorMessage: '加工清单保存失败，请检查内容后重试'
    }
  )
  if (!data) throw new Error('加工清单保存失败，请重试')
  return data
}

export async function finalizeAccessoryList(id: string): Promise<void> {
  await responseHandle(() => supabase.rpc('mdm_generate_accessory_processing', { p_list_id: id }), {
    breakReturn: true,
    showErrorMessage: false,
    errorMessage: '生成失败，请检查项目、草图和物料信息'
  })
}

export async function fetchAccessoryWorkOrders(listId: string): Promise<AccessoryWorkOrder[]> {
  const { data } = await responseHandle<AccessoryWorkOrder[]>(
    () =>
      supabase
        .from('mdm_accessory_work_order')
        .select(
          'id,orderNo:order_no,itemId:item_id,materialId:material_id,quantity,lengthM:length_m,status'
        )
        .eq('list_id', listId)
        .order('order_no'),
    { breakReturn: true, showErrorMessage: false, errorMessage: '生产加工单加载失败，请重试' }
  )
  return data ?? []
}
