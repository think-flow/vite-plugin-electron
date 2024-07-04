import type { Plugin } from 'vite'
import type { SourceMapInput } from 'rollup'
import MagicString from 'magic-string'
import { URL, URLSearchParams } from 'node:url'
import path from 'node:path'

const modulePathRE = /__ELECTRON_MODULE_PATH__([\w$]+)__/g

function parseRequest(id: string): any | null {
  const search = new URL(id, 'file:').search
  if (!search) return null
  return Object.fromEntries(new URLSearchParams(search))
}

function toRelativePath(filename: string, importer: string): string {
  const relPath = path.posix.relative(path.dirname(importer), filename)
  return relPath.startsWith('.') ? relPath : `./${relPath}`
}

/**
 * Support the `?modulePath` search parameter for import and return the module bundle path.
 */
export default function modulePathPlugin(): Plugin {
  let sourcemap: boolean | 'inline' | 'hidden' = false
  return {
    name: 'vite-plugin-electron:module-path',
    apply: 'build',
    enforce: 'pre',
    configResolved(config): void {
      sourcemap = config.build.sourcemap
    },
    resolveId(id, importer): string | void {
      const query = parseRequest(id)
      if (query && query.hasOwnProperty('modulePath')) {
        return `${id}&importer=${importer}`
      }
    },
    load(id): string | void {
      const query = parseRequest(id)
      if (query && query.hasOwnProperty('modulePath') && query.hasOwnProperty('importer')) {
        const hash = this.emitFile({
          type: 'chunk',
          id: id.split('?')[0],
          importer: query.importer
        })
        const refId = `__ELECTRON_MODULE_PATH__${hash}__`
        return `
        import { join, dirname } from 'node:path'
        import { fileURLToPath } from 'node:url'
        export default join(dirname(fileURLToPath(import.meta.url)), ${refId})
        `
      }
    },
    renderChunk(code, chunk): { code: string, map: SourceMapInput } | null {
      if (code.match(modulePathRE)) {
        const s = new MagicString(code)

        while (true) {
          const match = modulePathRE.exec(code)
          if (!match) break
          const [full, hash] = match
          const filename = this.getFileName(hash)
          const scriptFilePath = toRelativePath(filename, chunk.fileName)
          const replacement = JSON.stringify(scriptFilePath)
          s.overwrite(match.index, match.index + full.length, replacement, {
            contentOnly: true
          })
        }

        return {
          code: s.toString(),
          map: sourcemap ? s.generateMap({ hires: 'boundary' }) : null
        }
      }

      return null
    }
  }
}
