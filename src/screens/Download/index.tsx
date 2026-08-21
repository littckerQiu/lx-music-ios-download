import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { View, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import Text from '@/components/common/Text'
import Button from '@/components/common/Button'
import { useTheme } from '@/store/theme/hook'
import DownloadManager, { type DownloadTask } from '@/utils/DownloadManager'
import { exportDownloads } from '@/utils/DownloadExport'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import { pop } from '@/navigation'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { COMPONENT_IDS } from '@/config/constant'
import { setComponentId } from '@/core/common'
import { handlePlay } from '@/components/OnlineList/listAction'
import { Icon } from '@/components/common/Icon'
import { scaleSizeH } from '@/utils/pixelRatio'

interface Props {
  componentId: string
}

type FilterType = 'downloading' | 'failed' | 'completed'

const CATEGORIES: { key: FilterType; label: string }[] = [
  { key: 'downloading', label: '下载中' },
  { key: 'failed', label: '下载失败' },
  { key: 'completed', label: '下载完成' },
]

const ITEM_HEIGHT = scaleSizeH(40)

const DownloadScreen: React.FC<Props> = ({ componentId }) => {
  const theme = useTheme()
  const t = useI18n()
  const [tasks, setTasks] = useState<DownloadTask[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterType>('downloading')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)

  useEffect(() => {
    setComponentId(COMPONENT_IDS.download, componentId)
    const unsub = DownloadManager.subscribe(setTasks)
    setTasks(DownloadManager.getTasks())
    return () => { unsub() }
  }, [componentId])

  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case 'downloading':
        return tasks.filter(t => t.status === 'downloading' || t.status === 'preparing' || t.status === 'waiting' || t.status === 'paused')
      case 'failed':
        return tasks.filter(t => t.status === 'failed')
      case 'completed':
        return tasks.filter(t => t.status === 'completed')
      default:
        return []
    }
  }, [tasks, activeFilter])

  const counts = useMemo(() => ({
    downloading: tasks.filter(t => t.status === 'downloading' || t.status === 'preparing' || t.status === 'waiting' || t.status === 'paused').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }), [tasks])

  const getStatusText = (task: DownloadTask) => {
    switch (task.status) {
      case 'waiting': return '等待中'
      case 'preparing': return '获取链接中...'
      case 'downloading': return `下载中 ${(task.progress * 100).toFixed(1)}%`
      case 'paused': return '已暂停'
      case 'completed': return '已完成'
      case 'failed': return task.errorMessage || '下载失败'
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

  const handleTaskPress = (task: DownloadTask) => {
    if (isMultiSelectMode) {
      // 多选模式下切换选中
      const newSelected = new Set(selectedIds)
      if (newSelected.has(task.id)) {
        newSelected.delete(task.id)
      } else {
        newSelected.add(task.id)
      }
      setSelectedIds(newSelected)
      if (newSelected.size === 0) {
        setIsMultiSelectMode(false)
      }
    } else if (task.status === 'completed') {
      // 非多选模式下，已完成的单击播放
      handlePlay(task.musicInfo)
    }
  }

  const handleLongPress = (task: DownloadTask) => {
    if (task.status !== 'completed') return
    if (!isMultiSelectMode) {
      setIsMultiSelectMode(true)
      setSelectedIds(new Set([task.id]))
    }
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length) {
      setSelectedIds(new Set())
      setIsMultiSelectMode(false)
    } else {
      setSelectedIds(new Set(filteredTasks.map(t => t.id)))
    }
  }

  const handleExitSelect = () => {
    setIsMultiSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleExport = async () => {
    const selectedTasks = tasks.filter(t => selectedIds.has(t.id))
    if (selectedTasks.length === 0) return
    handleExitSelect()
    await exportDownloads(selectedTasks)
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
    if (isMultiSelectMode) {
      handleExitSelect()
      return
    }
    void pop(componentId)
  }

  const renderCategoryItem = ({ item }: { item: typeof CATEGORIES[0] }) => {
    const active = activeFilter === item.key
    const count = counts[item.key]
    return (
      <TouchableOpacity
        style={[styles.categoryItem, { height: ITEM_HEIGHT }, active && { backgroundColor: theme['c-primary-light-700-alpha-300'] }]}
        onPress={() => {
          setActiveFilter(item.key)
          handleExitSelect()
        }}
      >
        {active ? <Icon style={styles.categoryIcon} name="chevron-right" size={12} color={theme['c-primary-font']} /> : null}
        <Text style={styles.categoryText} color={active ? theme['c-primary-font'] : theme['c-font']} numberOfLines={1}>
          {item.label}({count})
        </Text>
      </TouchableOpacity>
    )
  }

  const renderTaskItem = ({ item }: { item: DownloadTask }) => {
    const isCompleted = item.status === 'completed'
    const isSelected = selectedIds.has(item.id)
    const canSelect = isCompleted

    return (
      <TouchableOpacity
        style={[
          styles.taskItem,
          { backgroundColor: theme['c-content-background'] },
          isSelected && { backgroundColor: theme['c-primary-light-700-alpha-300'] },
        ]}
        onPress={() => handleTaskPress(item)}
        onLongPress={() => handleLongPress(item)}
        disabled={!canSelect && !isMultiSelectMode}
      >
        {isMultiSelectMode && canSelect ? (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected ? <Icon name="check" size={14} color="#fff" /> : null}
          </View>
        ) : null}
        <View style={styles.taskInfo}>
          <Text style={styles.songName} color={theme['c-text']} numberOfLines={1}>
            {isCompleted && !isMultiSelectMode ? '▶ ' : ''}{item.musicInfo.name}
          </Text>
          <Text style={styles.artist} color={theme['c-text-secondary']} numberOfLines={1}>
            {item.musicInfo.singer || '未知艺术家'}
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
        {!isMultiSelectMode ? (
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
        ) : null}
      </TouchableOpacity>
    )
  }

  return (
    <PageContent>
      <StatusBar />
      <View style={[styles.header, { borderBottomColor: theme['c-border-background'] }]}>
        <Button onPress={handleBack} style={styles.headerBtn}>
          <Text color={theme['c-button-font']}>{isMultiSelectMode ? '取消' : t('back')}</Text>
        </Button>
        <Text style={styles.headerTitle} color={theme['c-text']}>
          {isMultiSelectMode ? `已选 ${selectedIds.size} 首` : '下载管理'}
        </Text>
        {isMultiSelectMode ? (
          <TouchableOpacity onPress={handleSelectAll} style={styles.headerBtn}>
            <Text color={theme['c-button-font']}>{selectedIds.size === filteredTasks.length ? '取消全选' : '全选'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <View style={styles.body}>
        <View style={[styles.sidebar, { borderRightColor: theme['c-border-background'] }]}>
          <FlatList
            data={CATEGORIES}
            renderItem={renderCategoryItem}
            keyExtractor={item => item.key}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.content}>
          <FlatList
            data={filteredTasks}
            renderItem={renderTaskItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text color={theme['c-text-secondary']}>
                  {activeFilter === 'downloading' ? '暂无下载中的任务' : activeFilter === 'failed' ? '暂无失败的任务' : '暂无已完成的任务'}
                </Text>
                {activeFilter === 'completed' ? (
                  <Text color={theme['c-text-secondary']} style={{ marginTop: 8, fontSize: 12 }}>
                    长按歌曲可多选导出
                  </Text>
                ) : null}
              </View>
            }
          />

          {isMultiSelectMode ? (
            <View style={[styles.multiBar, { borderTopColor: theme['c-border-background'] }]}>
              <TouchableOpacity
                style={[styles.multiBtn, selectedIds.size === 0 && { opacity: 0.4 }]}
                disabled={selectedIds.size === 0}
                onPress={handleExport}
              >
                <Text color={theme['c-primary']}>导出ZIP({selectedIds.size})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.multiBtn} onPress={handleExitSelect}>
                <Text color={theme['c-text']}>取消</Text>
              </TouchableOpacity>
            </View>
          ) : (
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
          )}
        </View>
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
    width: 70,
    paddingVertical: 8,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '500',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 120,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 20,
    flexGrow: 1,
  },
  taskItem: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  taskInfo: {
    flex: 1,
  },
  songName: {
    fontSize: 14,
    fontWeight: '500',
  },
  artist: {
    fontSize: 11,
    marginTop: 2,
  },
  status: {
    fontSize: 11,
    marginTop: 3,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 6,
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
    paddingVertical: 12,
    alignItems: 'center',
  },
  multiBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  multiBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
})

export default DownloadScreen
