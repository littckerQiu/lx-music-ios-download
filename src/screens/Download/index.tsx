import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import DownloadManager, { type DownloadTask } from '@/utils/DownloadManager'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import { pop } from '@/navigation'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { COMPONENT_IDS } from '@/config/constant'
import { setComponentId } from '@/core/common'

interface Props {
  componentId: string
}

const DownloadScreen: React.FC<Props> = ({ componentId }) => {
  const theme = useTheme()
  const t = useI18n()
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [filter, setFilter] = useState<'all' | 'downloading' | 'completed' | 'failed'>('all')

  useEffect(() => {
    setComponentId(COMPONENT_IDS.download, componentId)
    const unsub = DownloadManager.subscribe(setTasks)
    setTasks(DownloadManager.getTasks())
    return () => { unsub() }
  }, [componentId])

  const filteredTasks = useMemo(() => {
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

  const handleBack = () => {
    void pop(componentId)
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

  const filters: { key: typeof filter; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: stats.all },
    { key: 'downloading', label: '下载中', count: stats.downloading },
    { key: 'completed', label: '已完成', count: stats.completed },
    { key: 'failed', label: '失败', count: stats.failed },
  ]

  return (
    <PageContent>
      <StatusBar />
      {/* 顶栏 */}
      <View style={[styles.header, { borderBottomColor: theme['c-border-background'] }]}>
        <Button onPress={handleBack} style={styles.headerBtn}>
          <Text color={theme['c-button-font']}>{t('back')}</Text>
        </Button>
        <Text style={styles.headerTitle} color={theme['c-text']}>下载管理</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* 筛选栏 */}
      <View style={styles.filterBar}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterBtn, filter === f.key && { backgroundColor: theme['c-primary'] }]}
          >
            <Text color={filter === f.key ? '#fff' : theme['c-text']}>
              {f.label}({f.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 任务列表 */}
      <FlatList
        data={filteredTasks}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text color={theme['c-text-secondary']}>暂无下载任务</Text>
          </View>
        }
      />

      {/* 底部操作栏 */}
      <View style={[styles.bottomBar, { borderTopColor: theme['c-border-background'] }]}>
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

      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 60,
    paddingVertical: 8,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '500',
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
    paddingBottom: 20,
    flexGrow: 1,
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
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
})

export default DownloadScreen
