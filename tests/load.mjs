import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import ts from 'typescript'

// Transpile the actual TypeScript modules in memory; no test build artifacts.
async function moduleUrl(path) {
  let code = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const match of [...code.matchAll(/from ['"](\.[^'"]+)['"]/g)]) {
    code = code.replace(match[0], 'from ' + JSON.stringify(await moduleUrl(resolve(dirname(path), match[1] + '.ts'))))
  }
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}

/** Import a TypeScript source module by its path from the project root. */
export const load = async path => import(await moduleUrl(resolve(path)))
