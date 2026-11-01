import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const pages = [
  'components/material-reference/index.vue',
  'components/inventory-configuration/modules/outbound-rule-workspace.vue',
  'components/inventory-configuration/modules/supply-chain-code-rule-workspace.vue',
  'material-master/material-category/index.vue',
  'material-master/material-archive/index.vue',
  'inventory-master/warehouse-definition/index.vue',
  'engineering/production-equipment/index.vue',
  'engineering/esop/index.vue',
  'production/personnel/index.vue',
  'production/operation-template/index.vue'
]

interface TestRow {
  id: string
  status: 'enabled' | 'disabled'
  enabled: boolean
}

const enabledRow: TestRow = { id: 'enabled-record', status: 'enabled', enabled: true }
const disabledRow: TestRow = { id: 'disabled-record', status: 'disabled', enabled: false }

function property(node: ts.ObjectLiteralExpression, name: string) {
  return node.properties.find(
    (item): item is ts.PropertyAssignment =>
      ts.isPropertyAssignment(item) && item.name.getText() === name
  )?.initializer
}

function evaluate(node: ts.Expression, bindings: Record<string, unknown>): unknown {
  const javascript = ts.transpileModule(`const action = ${node.getText()}; action`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText
  return vm.runInNewContext(javascript, bindings)
}

for (const page of pages) {
  test(`${page}: status actions offer only a valid transition and submit only changed rows`, async () => {
    const { descriptor } = parse(readFileSync(new URL(page, import.meta.url), 'utf8'))
    assert.ok(descriptor.scriptSetup)
    const source = ts.createSourceFile(
      page,
      descriptor.scriptSetup.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const actions: Array<{ node: ts.ObjectLiteralExpression; enable: boolean }> = []
    function visit(node: ts.Node): void {
      if (ts.isObjectLiteralExpression(node) && property(node, 'selectionRequired')) {
        const permission = property(node, 'permission')?.getText() ?? ''
        if (/:Enable'|permission\('Enable'\)/.test(permission)) actions.push({ node, enable: true })
        if (/:Disable'|permission\('Disable'\)/.test(permission))
          actions.push({ node, enable: false })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    assert.equal(actions.length, 2)

    for (const { node, enable } of actions) {
      const hiddenExpression = property(node, 'hidden')
      const clickExpression = property(node, 'onClick')
      assert.ok(hiddenExpression)
      assert.ok(clickExpression)
      const hidden = evaluate(hiddenExpression, {})
      assert.equal(typeof hidden, 'function')
      const predicate = hidden as (context: { selectedRows: TestRow[] }) => boolean
      assert.equal(predicate({ selectedRows: [enabledRow] }), enable)
      assert.equal(predicate({ selectedRows: [disabledRow] }), !enable)
      assert.equal(predicate({ selectedRows: [enabledRow, disabledRow] }), false)

      const calls: unknown[][] = []
      const bindings: Record<string, unknown> = {
        config: { value: { kind: 'unit-of-measure' } },
        refresh: async () => {},
        refreshPeople: async () => {}
      }
      function bindSetter(child: ts.Node): void {
        if (
          ts.isCallExpression(child) &&
          ts.isIdentifier(child.expression) &&
          child.expression.text.startsWith('set')
        )
          bindings[child.expression.text] = async (...args: unknown[]) => calls.push(args)
        ts.forEachChild(child, bindSetter)
      }
      bindSetter(clickExpression)
      const callback = evaluate(clickExpression, bindings)
      assert.equal(typeof callback, 'function')
      await (callback as (context: object) => Promise<void>)({
        selectedRows: [enabledRow, disabledRow],
        api: { refreshUpdate: async () => {} }
      })
      assert.equal(calls.length, 1)
      assert.equal(calls[0].at(-1), enable)
      assert.equal(
        JSON.stringify(calls[0].at(-2)),
        JSON.stringify([enable ? disabledRow.id : enabledRow.id])
      )
    }
  })
}
