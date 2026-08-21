/**
 * 下载管理器 - iOS 端实现
 * 支持并发下载、进度跟踪、暂停/继续、失败重试
 */
import RNFS from 'react-native-fs'
import { getMusicUrl } from '@/core/music/online'
import { getLyricInfo } from '@/core/music/online'

export type DownloadStatus = 'waiting' | 'preparing' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface DownloadTask {
  id: string
  musicInfo: LX.Music.MusicInfoOnline
  status: DownloadStatus
  progress: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  errorMessage?: string
  localPath?: string
  createdAt: number
  completedAt?: number
}

type TaskListener = (tasks: DownloadTask[]) => void

const DOWNLOAD_DIR = RNFS.DocumentDirectoryPath + '/lx-music-downloads'
const MAX_CONCURRENT = 3

let tasks: DownloadTask[] = []
const listeners = new Set<TaskListener>()
const activeDownloads = new Map<string, { job: any; cancelled: boolean }>()
const cancelledTasks = new Set<string>()

// 确保下载目录存在
const ensureDir = async () => {
  try {
    const exists = await RNFS.exists(DOWNLOAD_DIR)
    if (!exists) await RNFS.mkdir(DOWNLOAD_DIR)
  } catch (e) {
    console.error('创建下载目录失败', e)
  }
}

const notify = () => {
  listeners.forEach(l => l([...tasks]))
}

const getTask = (id: string) => tasks.find(t => t.id === id)

const updateTask = (id: string, patch: Partial<DownloadTask>) => {
  tasks = tasks.map(t => t.id === id ? { ...t, ...patch } : t)
  notify()
}

const generateId = (musicInfo: LX.Music.MusicInfoOnline) => {
  return `${musicInfo.source}_${musicInfo.songmid}_${Date.now()}`
}

const sanitizeFilename = (name: string) => {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)
}

// 处理下载队列
const processQueue = () => {
  const activeCount = tasks.filter(t => t.status === 'downloading' || t.status === 'preparing').length
  const waitingTasks = tasks.filter(t => t.status === 'waiting')
  const slots = Math.max(0, MAX_CONCURRENT - activeCount)

  for (let i = 0; i < Math.min(slots, waitingTasks.length); i++) {
    startDownload(waitingTasks[i])
  }
}

// 开始下载单个任务
const startDownload = async (task: DownloadTask) => {
  if (cancelledTasks.has(task.id)) {
    cancelledTasks.delete(task.id)
    return
  }

  updateTask(task.id, { status: 'preparing' })

  try {
    // 1. 获取音乐链接
    const url = await getMusicUrl({ musicInfo: task.musicInfo, isRefresh: false })

    if (cancelledTasks.has(task.id)) {
      cancelledTasks.delete(task.id)
      return
    }

    if (!url || url.includes('fake')) {
      throw new Error('无法获取下载链接')
    }

    await ensureDir()

    // 2. 构建文件名
    const artist = task.musicInfo.meta.author || '未知艺术家'
    const title = task.musicInfo.name || '未知歌曲'
    const ext = url.includes('.flac') ? 'flac' : url.includes('.ape') ? 'ape' : 'mp3'
    const filename = sanitizeFilename(`${artist} - ${title}.${ext}`)
    const localPath = `${DOWNLOAD_DIR}/${filename}`

    // 3. 下载文件
    updateTask(task.id, { status: 'downloading' })

    const job = RNFS.downloadFile({
      fromUrl: url,
      toFile: localPath,
      progressDivider: 10,
      progress: (res) => {
        const currentTask = getTask(task.id)
        if (!currentTask || currentTask.status !== 'downloading') return
        const progress = res.bytesWritten / res.contentLength || 0
        updateTask(task.id, {
          progress,
          downloadedBytes: res.bytesWritten,
          totalBytes: res.contentLength,
        })
      },
    })

    activeDownloads.set(task.id, { job, cancelled: false })

    const result = await job.promise

    if (cancelledTasks.has(task.id)) {
      cancelledTasks.delete(task.id)
      activeDownloads.delete(task.id)
      return
    }

    if (result.statusCode === 200) {
      // 下载完成，尝试下载歌词
      try {
        const lyricInfo = await getLyricInfo({ musicInfo: task.musicInfo, isRefresh: false })
        if (lyricInfo?.lyric) {
          const lrcPath = localPath.replace(/\.[^.]+$/, '.lrc')
          await RNFS.writeFile(lrcPath, lyricInfo.lyric, 'utf8')
        }
      } catch (e) {
        // 歌词下载失败不影响主任务
      }

      updateTask(task.id, {
        status: 'completed',
        progress: 1,
        localPath,
        completedAt: Date.now(),
        speed: 0,
      })
    } else {
      throw new Error(`下载失败，状态码: ${result.statusCode}`)
    }
  } catch (error) {
    if (cancelledTasks.has(task.id)) {
      cancelledTasks.delete(task.id)
      return
    }
    const msg = error instanceof Error ? error.message : String(error)
    updateTask(task.id, {
      status: 'failed',
      errorMessage: msg,
      speed: 0,
    })
  } finally {
    activeDownloads.delete(task.id)
    processQueue()
  }
}

// 添加下载任务
export const addDownload = (musicInfo: LX.Music.MusicInfoOnline) => {
  const task: DownloadTask = {
    id: generateId(musicInfo),
    musicInfo,
    status: 'waiting',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    createdAt: Date.now(),
  }
  tasks = [...tasks, task]
  notify()
  processQueue()
  return task.id
}

// 批量添加下载
export const addDownloads = (musicInfos: LX.Music.MusicInfoOnline[]) => {
  const newTasks: DownloadTask[] = musicInfos.map(info => ({
    id: generateId(info),
    musicInfo: info,
    status: 'waiting',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    createdAt: Date.now(),
  }))
  tasks = [...tasks, ...newTasks]
  notify()
  processQueue()
  return newTasks.map(t => t.id)
}

// 暂停任务
export const pauseTask = (taskId: string) => {
  const task = getTask(taskId)
  if (!task) return
  if (task.status === 'downloading') {
    const active = activeDownloads.get(taskId)
    if (active) {
      active.job.stop()
      activeDownloads.delete(taskId)
    }
  }
  cancelledTasks.add(taskId)
  updateTask(taskId, { status: 'paused', speed: 0 })
}

// 恢复任务
export const resumeTask = (taskId: string) => {
  const task = getTask(taskId)
  if (!task || task.status !== 'paused') return
  updateTask(taskId, { status: 'waiting' })
  processQueue()
}

// 取消/删除任务
export const removeTask = (taskId: string, deleteFile = false) => {
  const task = getTask(taskId)
  if (task) {
    if (task.status === 'downloading' || task.status === 'preparing') {
      const active = activeDownloads.get(taskId)
      if (active) active.job.stop()
      activeDownloads.delete(taskId)
      cancelledTasks.add(taskId)
    }
    if (deleteFile && task.localPath) {
      RNFS.unlink(task.localPath).catch(() => {})
    }
  }
  tasks = tasks.filter(t => t.id !== taskId)
  notify()
  setTimeout(() => processQueue(), 100)
}

// 重试失败任务
export const retryTask = (taskId: string) => {
  const task = getTask(taskId)
  if (!task || task.status !== 'failed') return
  updateTask(taskId, { status: 'waiting', errorMessage: undefined })
  processQueue()
}

// 暂停全部
export const pauseAll = () => {
  tasks.forEach(t => {
    if (t.status === 'downloading' || t.status === 'preparing' || t.status === 'waiting') {
      pauseTask(t.id)
    }
  })
}

// 恢复全部
export const resumeAll = () => {
  tasks.forEach(t => {
    if (t.status === 'paused') {
      updateTask(t.id, { status: 'waiting' })
    }
  })
  processQueue()
}

// 清除已完成
export const clearCompleted = () => {
  tasks = tasks.filter(t => t.status !== 'completed')
  notify()
}

// 获取所有任务
export const getTasks = () => [...tasks]

// 订阅任务变化
export const subscribe = (listener: TaskListener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 获取下载目录
export const getDownloadDir = () => DOWNLOAD_DIR

export default {
  addDownload,
  addDownloads,
  pauseTask,
  resumeTask,
  removeTask,
  retryTask,
  pauseAll,
  resumeAll,
  clearCompleted,
  getTasks,
  subscribe,
  getDownloadDir,
}
