import fs from 'node:fs'
import path from 'node:path'
import { build } from 'vite'
import {
  describe,
  expect,
  it,
  beforeEach,
} from 'vitest'
import modulePathPlugin from '../dist/modulePath'

const plugin = modulePathPlugin()

describe('src/plugins/modulePath', () => {
  const outputDir = path.resolve(__dirname, 'dist')

  beforeEach(async () => {
    // Clean up the output directory before each test
    fs.rmSync(outputDir, { recursive: true, force: true })
  })

  it('should transform module paths correctly', async () => {
    await build({
      configFile: false,
      root: __dirname,
      build: {
        lib: {
          entry: 'fixtures/module_path/module-path-main.ts',
          formats: ['es'],
          fileName: () => 'module-path-main.js',
        },
        minify: false,
        rollupOptions: {
          external: ['node:path', 'node:url']
        }
      },
      plugins: [plugin],
    })
    const outputFile = await fs.promises.readFile(path.resolve(outputDir, 'module-path-main.js'), 'utf-8')
    expect(outputFile).toContain('const workPath = join(dirname(fileURLToPath(import.meta.url)), "./test-worker-BsxCbMxB.mjs")')
  })
})
