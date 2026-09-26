<template>
  <div ref="hostRef" class="rack-scene" aria-label="可旋转的立体货架视图">
    <canvas
      ref="canvasRef"
      class="rack-scene__canvas"
      aria-hidden="true"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerleave="hovered = null"
      @pointerup="handlePointerUp"
    />
    <div class="rack-scene__grid" aria-hidden="true"></div>
    <div class="rack-scene__labels">
      <button
        v-for="label in visibleLabels"
        :key="label.code"
        type="button"
        class="rack-scene__label"
        :class="{ 'is-selected': selectedRackCode === label.code }"
        :style="{ left: `${label.x}px`, top: `${label.y}px` }"
        :title="`${label.code} 货架`"
        @click="emit('selectRack', label.code)"
      >
        {{ label.code }}
      </button>
    </div>
    <div
      v-if="hovered"
      class="rack-scene__tooltip"
      :style="{ left: `${hovered.x}px`, top: `${hovered.y}px` }"
      role="status"
    >
      <strong>{{ hovered.bin.binCode }}</strong>
      <span>{{ hovered.bin.levelNo || 1 }} 层 · {{ hovered.bin.columnNo || 1 }} 列</span>
    </div>
    <div v-if="webglError" class="rack-scene__fallback">
      <ArtSvgIcon icon="ri:computer-line" aria-hidden="true" />
      <strong>当前浏览器无法显示立体场景</strong>
      <span>可在右侧货架层位列表中继续查看库位。</span>
    </div>
    <div v-else class="rack-scene__hint">拖动旋转 · 滚轮缩放 · 右键平移 · 点击层位查看详情</div>
  </div>
</template>

<script setup lang="ts">
  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
  import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
  import { useResizeObserver } from '@vueuse/core'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { StorageBin } from '@mdm/api'
  import type { BinTone, RackGroup } from './types'

  interface Props {
    racks: RackGroup[]
    selectedRackCode: string
    selectedBinId: string
    columnGap: number
    levelGap: number
    viewMode: 'spatial' | 'top'
    toneFor: (bin: StorageBin) => BinTone
  }
  interface SceneBin {
    bin: StorageBin
    rackCode: string
    position: THREE.Vector3
  }
  interface RackAnchor {
    code: string
    position: THREE.Vector3
  }
  interface RackLabel {
    code: string
    x: number
    y: number
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    selectBin: [bin: StorageBin, rackCode: string]
    selectRack: [rackCode: string]
  }>()
  const hostRef = ref<HTMLDivElement>()
  const canvasRef = ref<HTMLCanvasElement>()
  const visibleLabels = ref<RackLabel[]>([])
  const hovered = ref<{ bin: StorageBin; x: number; y: number } | null>(null)
  const webglError = ref(false)

  const BOX_WIDTH = 1.06
  const BOX_HEIGHT = 0.28
  const BOX_DEPTH = 0.92
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000)
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const binGeometry = new RoundedBoxGeometry(BOX_WIDTH, BOX_HEIGHT, BOX_DEPTH, 2, 0.045)
  const binMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.63,
    metalness: 0.16
  })
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x43536a,
    roughness: 0.72,
    metalness: 0.22
  })
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x182436, roughness: 1 })
  const selectionMaterial = new THREE.LineBasicMaterial({ color: 0x8fa7ff, depthTest: false })
  const selectionBox = new THREE.BoxGeometry(BOX_WIDTH + 0.07, BOX_HEIGHT + 0.07, BOX_DEPTH + 0.07)
  const selectionOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(selectionBox),
    selectionMaterial
  )
  selectionBox.dispose()
  selectionOutline.renderOrder = 3
  selectionOutline.visible = false
  scene.add(selectionOutline)
  scene.add(new THREE.AmbientLight(0xffffff, 1.45))
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
  keyLight.position.set(-12, 24, 18)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(1024, 1024)
  keyLight.shadow.camera.left = -35
  keyLight.shadow.camera.right = 35
  keyLight.shadow.camera.top = 35
  keyLight.shadow.camera.bottom = -35
  keyLight.shadow.bias = -0.0004
  keyLight.shadow.intensity = 0.38
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(0xa8c4ee, 0.72)
  rimLight.position.set(14, 10, -12)
  scene.add(rimLight)

  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let binMesh: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null = null
  let floorMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null
  let floorGrid: THREE.GridHelper | null = null
  let rackBases: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = []
  let sceneBins: SceneBin[] = []
  let rackAnchors: RackAnchor[] = []
  let bounds = new THREE.Box3()
  let pointerStart: { x: number; y: number } | null = null

  function themeColor(name: string, fallback: string): THREE.Color {
    const value = hostRef.value && getComputedStyle(hostRef.value).getPropertyValue(name).trim()
    return new THREE.Color(value || fallback)
  }
  function toneColor(tone: BinTone): THREE.Color {
    if (tone === 'occupied') return themeColor('--el-color-success', '#25c9a5')
    if (tone === 'abnormal') return themeColor('--el-color-warning', '#e9a44f')
    if (tone === 'disabled') return themeColor('--el-color-info', '#586779')
    return new THREE.Color('#94a5ba')
  }
  function render(): void {
    if (!renderer || !hostRef.value) return
    camera.updateMatrixWorld()
    renderer.render(scene, camera)
    const width = hostRef.value.clientWidth
    const height = hostRef.value.clientHeight
    const occupied = new Set<string>()
    const candidates = rackAnchors
      .map(({ code, position }) => {
        const projected = position.clone().project(camera)
        return {
          code,
          x: (projected.x * 0.5 + 0.5) * width,
          y: (-projected.y * 0.5 + 0.5) * height,
          behind: projected.z > 1
        }
      })
      .sort(
        (a, b) =>
          Number(b.code === props.selectedRackCode) - Number(a.code === props.selectedRackCode)
      )
    visibleLabels.value = candidates
      .filter((label) => {
        if (
          label.behind ||
          label.x < 35 ||
          label.x > width - 35 ||
          label.y < 32 ||
          label.y > height - 60
        )
          return false
        const cell = `${Math.round(label.x / 74)}:${Math.round(label.y / 32)}`
        if (occupied.has(cell)) return false
        occupied.add(cell)
        return true
      })
      .map(({ code, x, y }) => ({ code, x, y }))
  }
  function resize(): void {
    if (!renderer || !hostRef.value) return
    const width = Math.max(1, hostRef.value.clientWidth)
    const height = Math.max(1, hostRef.value.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    render()
  }
  function clearLayout(): void {
    if (binMesh) {
      scene.remove(binMesh)
      binMesh.dispose()
      binMesh = null
    }
    if (floorMesh) {
      scene.remove(floorMesh)
      floorMesh.geometry.dispose()
      floorMesh = null
    }
    if (floorGrid) {
      scene.remove(floorGrid)
      floorGrid.geometry.dispose()
      ;(floorGrid.material as THREE.Material).dispose()
      floorGrid = null
    }
    rackBases.forEach((base) => {
      scene.remove(base)
      base.geometry.dispose()
    })
    rackBases = []
    sceneBins = []
    rackAnchors = []
  }
  function buildLayout(): void {
    clearLayout()
    if (!props.racks.length) {
      visibleLabels.value = []
      render()
      return
    }

    const columnStep = BOX_WIDTH + 0.25 + props.columnGap / 42
    const levelStep = BOX_HEIGHT + 0.055 + props.levelGap / 52
    const rackGap = 1.45
    const rowGap = 2.7
    const rowCount = Math.max(1, Math.ceil(Math.sqrt(props.racks.length * 0.75)))
    const rows: RackGroup[][] = []
    for (let index = 0; index < props.racks.length; index += rowCount)
      rows.push(props.racks.slice(index, index + rowCount))
    const positions: Array<{ rack: RackGroup; x: number; z: number; width: number }> = []
    let maxX = 0
    rows.forEach((row, rowIndex) => {
      let cursorX = 0
      row.forEach((rack) => {
        const width = Math.max(BOX_WIDTH, (rack.columns.length - 1) * columnStep + BOX_WIDTH)
        positions.push({ rack, x: cursorX, z: rowIndex * rowGap, width })
        cursorX += width + rackGap
      })
      maxX = Math.max(maxX, cursorX - rackGap)
    })
    const maxZ = Math.max(BOX_DEPTH, (rows.length - 1) * rowGap + BOX_DEPTH)
    const maxLevel = Math.max(
      1,
      ...props.racks.flatMap((rack) =>
        rack.columns.flatMap((column) => column.bins.map((bin) => bin.levelNo ?? 1))
      )
    )
    bounds = new THREE.Box3(
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(maxX + 1, maxLevel * levelStep + 1.1, maxZ + 1)
    )
    const dummy = new THREE.Object3D()
    const totalBins = props.racks.reduce((count, rack) => count + rack.binCount, 0)
    binMesh = new THREE.InstancedMesh(binGeometry, binMaterial, totalBins)
    binMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    binMesh.castShadow = true
    binMesh.receiveShadow = true
    positions.forEach(({ rack, x, z, width }) => {
      rack.columns.forEach((column, columnIndex) => {
        column.bins.forEach((bin) => {
          const position = new THREE.Vector3(
            x + columnIndex * columnStep + BOX_WIDTH / 2,
            (bin.levelNo ?? 1) * levelStep,
            z + BOX_DEPTH / 2
          )
          dummy.position.copy(position)
          dummy.updateMatrix()
          const index = sceneBins.length
          binMesh?.setMatrixAt(index, dummy.matrix)
          binMesh?.setColorAt(index, toneColor(props.toneFor(bin)))
          sceneBins.push({ bin, rackCode: rack.code, position })
        })
      })
      const base = new THREE.Mesh(
        new RoundedBoxGeometry(width + 0.34, 0.09, BOX_DEPTH + 0.3, 2, 0.035),
        baseMaterial
      )
      base.position.set(x + width / 2, 0.055, z + BOX_DEPTH / 2)
      base.receiveShadow = true
      scene.add(base)
      rackBases.push(base)
      rackAnchors.push({
        code: rack.code,
        position: new THREE.Vector3(
          x + width / 2,
          Math.max(
            1,
            ...rack.columns.flatMap((column) => column.bins.map((bin) => bin.levelNo ?? 1))
          ) *
            levelStep +
            0.55,
          z + BOX_DEPTH / 2
        )
      })
    })
    binMesh.instanceMatrix.needsUpdate = true
    if (binMesh.instanceColor) binMesh.instanceColor.needsUpdate = true
    scene.add(binMesh)
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(maxX + 3.6, maxZ + 3.6), groundMaterial)
    floorMesh.rotation.x = -Math.PI / 2
    floorMesh.position.set(maxX / 2, 0, maxZ / 2)
    floorMesh.receiveShadow = true
    scene.add(floorMesh)
    floorGrid = new THREE.GridHelper(
      Math.max(maxX + 3.6, maxZ + 3.6),
      Math.max(12, Math.ceil(Math.max(maxX, maxZ) * 0.85)),
      0x304058,
      0x223147
    )
    floorGrid.position.set(maxX / 2, 0.015, maxZ / 2)
    scene.add(floorGrid)
    updateSelection()
    fitCamera()
  }
  function fitCamera(): void {
    if (!controls || !hostRef.value) return
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    center.y = Math.max(0, center.y - 0.45)
    const fov = THREE.MathUtils.degToRad(camera.fov)
    const aspect = Math.max(
      0.65,
      hostRef.value.clientWidth / Math.max(1, hostRef.value.clientHeight)
    )
    const span = Math.max(size.x / aspect, size.z, size.y * 1.5)
    const distance = Math.max(5, (span / (2 * Math.tan(fov / 2))) * 1.08)
    camera.up.set(0, 1, 0)
    if (props.viewMode === 'top')
      camera.position.set(center.x, center.y + distance, center.z + 0.02)
    else
      camera.position.set(
        center.x + distance * 0.58,
        center.y + distance * 0.7,
        center.z + distance * 0.82
      )
    camera.near = 0.1
    camera.far = Math.max(3000, distance * 5)
    camera.updateProjectionMatrix()
    controls.target.copy(center)
    controls.enableRotate = props.viewMode === 'spatial'
    controls.minDistance = Math.max(2.5, distance * 0.18)
    controls.maxDistance = distance * 4
    controls.update()
    render()
  }
  function updateSelection(): void {
    const item = sceneBins.find(({ bin }) => bin.id === props.selectedBinId)
    selectionOutline.visible = Boolean(item)
    if (item) selectionOutline.position.copy(item.position)
    selectionMaterial.color.copy(themeColor('--el-color-primary', '#6b72ef'))
    render()
  }
  function focusBin(binId: string): void {
    if (!controls) return
    const item = sceneBins.find(({ bin }) => bin.id === binId)
    if (!item) return
    if (props.viewMode === 'top') {
      camera.position.set(item.position.x, item.position.y + 7.5, item.position.z + 0.02)
    } else {
      const rackCenter = rackAnchors.find((rack) => rack.code === item.rackCode)?.position.x
      const side = rackCenter !== undefined && item.position.x > rackCenter ? 1 : -1
      camera.position.set(item.position.x + side * 6, item.position.y + 1.85, item.position.z - 2)
    }
    controls.target.copy(item.position)
    controls.minDistance = 2.5
    controls.update()
    render()
  }
  function pick(event: PointerEvent): SceneBin | null {
    if (!binMesh || !canvasRef.value) return null
    const rect = canvasRef.value.getBoundingClientRect()
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(binMesh, false)[0]
    return hit?.instanceId === undefined ? null : (sceneBins[hit.instanceId] ?? null)
  }
  function handlePointerDown(event: PointerEvent): void {
    pointerStart = { x: event.clientX, y: event.clientY }
  }
  function handlePointerMove(event: PointerEvent): void {
    if (event.buttons) {
      hovered.value = null
      return
    }
    const item = pick(event)
    hovered.value = item ? { bin: item.bin, x: event.offsetX + 14, y: event.offsetY + 14 } : null
    if (canvasRef.value) canvasRef.value.style.cursor = item ? 'pointer' : 'grab'
  }
  function handlePointerUp(event: PointerEvent): void {
    const moved =
      pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
    pointerStart = null
    if (moved === null || moved > 5) return
    const item = pick(event)
    if (item) emit('selectBin', item.bin, item.rackCode)
  }

  defineExpose({ resetView: fitCamera, focusBin })

  useResizeObserver(hostRef, resize)
  watch(() => [props.racks, props.columnGap, props.levelGap], buildLayout)
  watch(() => props.viewMode, fitCamera)
  watch(() => props.selectedBinId, updateSelection)
  onMounted(() => {
    if (!canvasRef.value) return
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.value,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.3
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFShadowMap
      controls = new OrbitControls(camera, canvasRef.value)
      controls.enableDamping = false
      controls.screenSpacePanning = true
      controls.minPolarAngle = 0.08
      controls.maxPolarAngle = Math.PI / 2 - 0.05
      controls.addEventListener('change', render)
      resize()
      buildLayout()
    } catch {
      webglError.value = true
    }
  })
  onBeforeUnmount(() => {
    controls?.removeEventListener('change', render)
    controls?.dispose()
    clearLayout()
    binGeometry.dispose()
    binMaterial.dispose()
    baseMaterial.dispose()
    groundMaterial.dispose()
    selectionOutline.geometry.dispose()
    selectionMaterial.dispose()
    renderer?.dispose()
  })
</script>

<style scoped lang="scss">
  .rack-scene {
    position: relative;
    min-width: 0;
    height: 100%;
    min-height: 500px;
    overflow: hidden;
    background: radial-gradient(circle at 47% 38%, #223249 0%, #131d2c 64%, #0e1724 100%);
    border-radius: var(--art-surface-radius);
  }

  .rack-scene__canvas,
  .rack-scene__grid,
  .rack-scene__labels {
    position: absolute;
    inset: 0;
  }

  .rack-scene__canvas {
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
  }

  .rack-scene__canvas:active {
    cursor: grabbing;
  }

  .rack-scene__grid {
    z-index: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgb(255 255 255 / 3%) 1px, transparent 1px),
      linear-gradient(90deg, rgb(255 255 255 / 3%) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: linear-gradient(to bottom, transparent, #000 65%);
  }

  .rack-scene__labels {
    z-index: 2;
    pointer-events: none;
  }

  .rack-scene__label {
    position: absolute;
    max-width: 84px;
    padding: 3px 7px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 10px;
    font-weight: 700;
    color: #e5edfc;
    white-space: nowrap;
    pointer-events: auto;
    outline-offset: 2px;
    background: rgb(28 47 73 / 92%);
    border: 1px solid rgb(143 173 216 / 42%);
    border-radius: 4px;
    transform: translate(-50%, -50%);
  }

  .rack-scene__label.is-selected {
    color: #fff;
    background: color-mix(in srgb, var(--el-color-primary) 64%, #172237);
    border-color: var(--el-color-primary);
  }

  .rack-scene__label:focus-visible {
    outline: 2px solid #fff;
  }

  .rack-scene__tooltip {
    position: absolute;
    z-index: 3;
    display: grid;
    gap: 2px;
    padding: 7px 9px;
    font-size: 11px;
    color: #f4f7fd;
    pointer-events: none;
    background: rgb(14 25 40 / 95%);
    border: 1px solid rgb(188 207 231 / 35%);
    border-radius: 6px;
    box-shadow: 0 8px 20px rgb(0 0 0 / 18%);
  }

  .rack-scene__tooltip span {
    color: #c2d0e2;
  }

  .rack-scene__hint {
    position: absolute;
    right: 16px;
    bottom: 14px;
    z-index: 2;
    font-size: 11px;
    color: #b6c3d4;
    pointer-events: none;
  }

  .rack-scene__fallback {
    position: absolute;
    inset: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 9px;
    align-items: center;
    justify-content: center;
    color: #e5edfc;
    text-align: center;
    background: #172337;
  }

  .rack-scene__fallback span {
    font-size: 12px;
    color: #b6c3d4;
  }

  @media (width <= 640px) {
    .rack-scene {
      min-height: 420px;
    }

    .rack-scene__hint {
      right: 12px;
      left: 12px;
      text-align: center;
    }
  }
</style>
