/**
 * 下载管理器 - 改进版
 * 复用播放器的链接获取逻辑，顺序下载避免限流
 */
import RNFS from 'react-native-fs'
import { getMusicUrlInfo } from '@/core/music/online'

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
  retryCount: number
}

type TaskListener = (tasks: DownloadTask[]) => void

const DOWNLOAD_DIR = RNFS.DocumentDirectoryPath + '/lx-music-downloads'
const MAX_CONCURRENT = 1
const MAX_RETRY = 3
const URL_TIMEOUT = 30000

let tasks: DownloadTask[] = []
const listeners = new Set<TaskListener>()
const activeDownloads = new Map<string, { job: any; cancelled: boolean }>()
const cancelledTasks = new Set<string>()
let isProcessing = false

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
  return `${musicInfo.source}_${musicInfo.songmid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const sanitizeFilename = (name: string) => {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)
}

const getUrlWithTimeout = (musicInfo: LX.Music.MusicInfoOnline): Promise<{ url: string; quality: LX.Quality | null }> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('获取链接超时'))
    }, URL_TIMEOUT)

    const toggleMusicInfo = musicInfo.meta.toggleMusicInfo
    const urlPromise = toggleMusicInfo
      ? getMusicUrlInfo({ musicInfo: toggleMusicInfo, isRefresh: false, allowToggleSource: false }).catch(() =>
          getMusicUrlInfo({ musicInfo, isRefresh: false })
        )
      : getMusicUrlInfo({ musicInfo, isRefresh: false })

    urlPromise.then(result => {
      clearTimeout(timeout)
      resolve(result)
    }).catch(err => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

const processQueue = async () => {
  if (isProcessing) return
  isProcessing = true

  try {
    while (true) {
      const activeCount = tasks.filter(t => t.status === 'downloading' || t.status === 'preparing').length
      if (activeCount >= MAX_CONCURRENT) break

      const waitingTask = tasks.find(t => t.status === 'waiting')
      if (!waitingTask) break

      await startDownload(waitingTask)
    }
  } finally {
    isProcessing = false
  }
}

const startDownload = async (task: DownloadTask) => {
  if (cancelledTasks.has(task.id)) {
    cancelledTasks.delete(task.id)
    return
  }

  updateTask(task.id, { status: 'preparing' })

  try {
    const result = await getUrlWithTimeout(task.musicInfo)

    if (cancelledTasks.has(task.id)) {
      cancelledTasks.delete(task.id)
      return
    }

    if (!result || !result.url) {
      throw new Error('无法获取下载链接')
    }

    if (result.url.includes('fake')) {
      throw new Error('无效的下载链接')
    }

    await ensureDir()

    const artist = task.musicInfo.meta.author || '未知艺术家'
    const title = task.musicInfo.name || '未知歌曲'
    const ext = result.url.includes('.flac') ? 'flac' : result.url.includes('.ape') ? 'ape' : result.url.includes('.m4a') ? 'm4a' : 'mp3'
    const filename = sanitizeFilename(`${artist} - ${title}.${ext}`)
    const localPath = `${DOWNLOAD_DIR}/${filename}`

    updateTask(task.id, { status: 'downloading' })

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    }

    const source = task.musicInfo.source
    const refererMap: Record<string, string> = {
      kw: 'https://www.kuwo.cn/',
      kg: 'https://www.kugou.com/',
      tx: 'https://y.qq.com/',
      wy: 'https://music.163.com/',
      mg: 'https://music.migu.cn/',
    }
    if (refererMap[source]) {
      headers['Referer'] = refererMap[source]
    }

    const job = RNFS.downloadFile({
      fromUrl: result.url,
      toFile: localPath,
      headers,
      progressDivider: 10,
      progress: (res) => {
        const currentTask = getTask(task.id)
        if (!currentTask || currentTask.status !== 'downloading') return
        const progress = res.contentLength > 0 ? res.bytesWritten / res.contentLength : 0
        updateTask(task.id, {
          progress,
          downloadedBytes: res.bytesWritten,
          totalBytes: res.contentLength,
        })
      },
    })

    activeDownloads.set(task.id, { job, cancelled: false })

    const result2 = await job.promise

    if (cancelledTasks.has(task.id)) {
      cancelledTasks.delete(task.id)
      activeDownloads.delete(task.id)
      return
    }

    if (result2.statusCode === 200 || result2.statusCode === 206) {
      updateTask(task.id, {
        status: 'completed',
        progress: 1,
        localPath,
        completedAt: Date.now(),
        speed: 0,
      })
    } else if (result2.statusCode === 403) {
      throw new Error('下载被禁止(403)，可能需要登录或有防盗链')
    } else if (result2.statusCode === 404) {
      throw new Error('文件不存在(404)')
    } else {
      throw new Error(`下载失败，状态码: ${result2.statusCode}`)
    }
  } catch (error) {
    if (cancelledTasks.has(task.id)) {
      cancelledTasks.delete(task.id)
      return
    }

    const msg = error instanceof Error ? error.message : String(error)
    const currentTask = getTask(task.id)

    if (currentTask && currentTask.retryCount < MAX_RETRY && !msg.includes('超时')) {
      updateTask(task.id, {
        status: 'waiting',
        retryCount: currentTask.retryCount + 1,
        errorMessage: `${msg} (重试中 ${currentTask.retryCount + 1}/${MAX_RETRY})`,
      })
    } else {
      updateTask(task.id, {
        status: 'failed',
        errorMessage: msg,
        speed: 0,
      })
    }
  } finally {
    activeDownloads.delete(task.id)
    setTimeout(() => processQueue(), 500)
  }
}

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
    retryCount: 0,
  }
  tasks = [...tasks, task]
  notify()
  void processQueue()
  return task.id
}

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
    retryCount: 0,
  }))
  tasks = [...tasks, ...newTasks]
  notify()
  void processQueue()
  return newTasks.map(t => t.id)
}

export const pauseTask = (taskId: string) => {
  const task = getTask(taskId)
  if (!task) return
  if (task.status === 'downloading' || task.status === 'preparing') {
    const active = activeDownloads.get(taskId)
    if (active) {
      active.job.stop()
      activeDownloads.delete(taskId)
    }
  }
  cancelledTasks.add(taskId)
  updateTask(taskId, { status: 'paused', speed: 0 })
}

export const resumeTask = (taskId: string) => {
  const task = getTask(taskId)
  if (!task || task.status !== 'paused') return
  updateTask(taskId, { status: 'waiting', retryCount: 0 })
  void processQueue()
}

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

export const retryTask = (taskId: string) => {
  const task = getTask(taskId)
  if (!task || task.status !== 'failed') return
  updateTask(taskId, { status: 'waiting', errorMessage: undefined, retryCount: 0 })
  void processQueue()
}

export const pauseAll = () => {
  tasks.forEach(t => {
    if (t.status === 'downloading' || t.status === 'preparing' || t.status === 'waiting') {
      pauseTask(t.id)
    }
  })
}

export const resumeAll = () => {
  tasks.forEach(t => {
    if (t.status === 'paused') {
      updateTask(t.id, { status: 'waiting', retryCount: 0 })
    }
  })
  void processQueue()
}

export const clearCompleted = () => {
  tasks = tasks.filter(t => t.status !== 'completed')
  notify()
}

export const getTasks = () => [...tasks]

export const subscribe = (listener: TaskListener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

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
