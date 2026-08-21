import React, { useEffect, useState, useCallback } from 'react'
import { View, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import DownloadManager, { type DownloadTask } from '@/utils/DownloadManager'
import { Navigation } from 'react-native-navigation'
import { createStyle } from '@/utils/tools'

interface Props {
  componentId: string
}

const DownloadScreen: React.FC<Props> = ({ componentId }) => {
  const theme = useTheme()
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [filter, setFilter] = useState<'all' | 'downloading' | 'completed' | 'failed'>('all')

  useEffect(() => {
    const unsub = DownloadManager.subscribe(setTasks)
    setTasks(DownloadManager.getTasks())
    return () => { unsub() }
  }, [])

  const filteredTasks = useCallback(() => {
    switch (filter) {
      case 'downloading':
        return tasks.filter(t => t.status === 'downloading' || t.status === 'preparing' || t.status === 'waiting')
      case 'completed':
        return tasks.filter(t => t.status === 'completed')
      case 'failed':
        return tasks.filter(t => t.status === 'failed')
      default:
        return tasks
    }
  }, [tasks, filter])

  const getStatusText = (task: DownloadTask) => {
    switch (task.status) {
      case 'waiting': return '等待中'
      case 'preparing': return '获取链接中...'
      case 'downloading': return `下载中 ${(task.progress * 100).toFixed(1)}%`
      case 'paused': return '已暂停'
      case 'completed': return '已完成'
      case 'failed': return `失败: ${task.errorMessage || '未知错误'}`
      case 'cancelled': return '已取消'
      default: return task.status
    }
  }

  const getStatusColor = (task: DownloadTask) => {
    switch (task.status) {
      case 'failed': return '#ff6b6b'
      case 'completed': return '#4caf50'
      case 'downloading':
      case 'preparing': return theme['c-primary']
      default: return theme['c-text-secondary']
    }
  }

  const handleAction = (task: DownloadTask) => {
    if (task.status === 'downloading' || task.status === 'preparing' || task.status === 'waiting') {
      DownloadManager.pauseTask(task.id)
    } else if (task.status === 'paused') {
      DownloadManager.resumeTask(task.id)
    } else if (task.status === 'failed') {
      DownloadManager.retryTask(task.id)
    }
  }

  const handleDelete = (task: DownloadTask) => {
    Alert.alert(
      '删除任务',
      `确定删除「${task.musicInfo.name}」？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => DownloadManager.removeTask(task.id) },
      ]
    )
  }

  const renderItem = ({ item }: { item: DownloadTask }) => (
    <View style={[styles.taskItem, { backgroundColor: theme['c-content-background'] }]}>
      <View style={styles.taskInfo}>
        <Text style={styles.songName} color={theme['c-text']} numberOfLines={1}>{item.musicInfo.name}</Text>
        <Text style={styles.artist} color={theme['c-text-secondary']} numberOfLines={1}>
          {item.musicInfo.meta.author || '未知艺术家'}
        </Text>
        <Text style={[styles.status, { color: getStatusColor(item) }]} numberOfLines={1}>
          {getStatusText(item)}
        </Text>
        {(item.status === 'downloading' || item.status === 'preparing') && (
          <View style={[styles.progressBar, { backgroundColor: theme['c-border-background'] }]}>
            <View style={[styles.progressFill, { width: `${item.progress * 100}%`, backgroundColor: theme['c-primary'] }]} />
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {(item.status === 'downloading' || item.status === 'preparing' || item.status === 'waiting') && (
          <TouchableOpacity onPress={() => handleAction(item)} style={styles.actionBtn}>
            <Text color={theme['c-primary']}>暂停</Text>
          </TouchableOpacity>
        )}
        {item.status === 'paused' && (
          <TouchableOpacity onPress={() => handleAction(item)} style={styles.actionBtn}>
            <Text color={theme['c-primary']}>继续</Text>
          </TouchableOpacity>
        )}
        {item.status === 'failed' && (
          <TouchableOpacity onPress={() => handleAction(item)} style={styles.actionBtn}>
            <Text color={theme['c-primary']}>重试</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
          <Text color="#ff6b6b">删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const stats = {
    all: tasks.length,
    downloading: tasks.filter(t => t.status === 'downloading' || t.status === 'preparing' || t.status === 'waiting').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }

  return (
    <View style={[styles.container, { backgroundColor: theme['c-background'] }]}>
      <View style={styles.filterBar}>
        {(['all', 'downloading', 'completed', 'failed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && { backgroundColor: theme['c-primary'] }]}
          >
            <Text color={filter === f ? '#fff' : theme['c-text']}>
              {f === 'all' ? `全部(${stats.all})` : f === 'downloading' ? `下载中(${stats.downloading})` : f === 'completed' ? `已完成(${stats.completed})` : `失败(${stats.failed})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredTasks()}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text color={theme['c-text-secondary']}>暂无下载任务</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => DownloadManager.pauseAll()} style={styles.bottomBtn}>
          <Text color={theme['c-primary']}>全部暂停</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => DownloadManager.resumeAll()} style={styles.bottomBtn}>
          <Text color={theme['c-primary']}>全部开始</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('清除记录', '确定清除所有已完成的下载记录？', [
              { text: '取消', style: 'cancel' },
              { text: '确定', onPress: () => DownloadManager.clearCompleted() },
            ])
          }}
          style={styles.bottomBtn}
        >
          <Text color={theme['c-primary']}>清除记录</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 60,
  },
  taskItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  taskInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 15,
    fontWeight: '500',
  },
  artist: {
    fontSize: 12,
    marginTop: 2,
  },
  status: {
    fontSize: 12,
    marginTop: 4,
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
})

export default DownloadScreen
