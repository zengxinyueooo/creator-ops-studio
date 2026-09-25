import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const target = resolve(import.meta.dirname, '../node_modules/@jackwener/opencli/clis/xiaohongshu/publish.js')
const source = await readFile(target, 'utf8')
const before = "msg.includes('Not allowed'))"
const after = "msg.includes('Not allowed') || msg.includes('fileChooserOpened not received'))"
if (source.includes(after)) process.exit(0)
if (!source.includes(before)) throw new Error('OpenCLI 图片上传逻辑已变化，请检查兼容补丁后再暂存')
await writeFile(target, source.replace(before, after))
