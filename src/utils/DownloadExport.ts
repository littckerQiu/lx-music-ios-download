/**
 * 下载导出工具
 * 把选中的音乐及附属资源打包为zip并分享
 */
import RNFS from 'react-native-fs'
import JSZip from 'jszip'
import { shareFile } from '@/utils/nativeModules/utils'
import { toast } from '@/utils/tools'
import type { DownloadTask } from './DownloadManager'

// 查找文件的所有附属文件（歌词、封面）
const findRelatedFiles = async (basePath: string): Promise<string[]> => {
  const dir = basePath.substring(0, basePath.lastIndexOf('/'))
  const baseName = basePath.substring(basePath.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
  const files: string[] = []

  try {
    const dirFiles = await RNFS.readDir(dir)
    for (const f of dirFiles) {
      if (f.name.startsWith(baseName) && f.name !== basePath.substring(basePath.lastIndexOf('/') + 1)) {
        files.push(f.path)
      }
    }
  } catch (e) {
    console.log('find related files failed:', e)
  }
  return files
}

// 导出选中的下载任务为zip
export const exportDownloads = async (tasks: DownloadTask[]): Promise<void> => {
  if (tasks.length === 0) {
    toast('请先选择要导出的音乐')
    return
  }

  const completedTasks = tasks.filter(t => t.status === 'completed' && t.localPath)
  if (completedTasks.length === 0) {
    toast('没有可导出的已完成音乐')
    return
  }

  toast(`正在打包 ${completedTasks.length} 首音乐...`)

  try {
    const zip = new JSZip()
    const folder = zip.folder('lx-music-export')!

    for (const task of completedTasks) {
      if (!task.localPath) continue

      // 读取主文件
      try {
        const fileName = task.localPath.substring(task.localPath.lastIndexOf('/') + 1)
        const data = await RNFS.readFile(task.localPath, 'base64')
        folder.file(fileName, data, { base64: true })

        // 查找并添加附属文件（歌词、封面）
        const relatedFiles = await findRelatedFiles(task.localPath)
        for (const rf of relatedFiles) {
          try {
            const rfName = rf.substring(rf.lastIndexOf('/') + 1)
            const rfData = await RNFS.readFile(rf, 'base64')
            folder.file(rfName, rfData, { base64: true })
          } catch (e) {
            console.log('read related file failed:', e)
          }
        }
      } catch (e) {
        console.log('read file failed:', e)
      }
    }

    // 生成zip
    const content = await zip.generateAsync({ type: 'base64' })
    const zipPath = `${RNFS.TemporaryDirectoryPath}/lx-music-export-${Date.now()}.zip`
    await RNFS.writeFile(zipPath, content, 'base64')

    // 分享
    await shareFile('导出音乐', zipPath)

    // 清理临时文件
    setTimeout(() => {
      RNFS.unlink(zipPath).catch(() => {})
    }, 5000)

    toast('导出成功')
  } catch (e) {
    console.log('export failed:', e)
    toast('导出失败: ' + (e instanceof Error ? e.message : String(e)))
  }
}
