import { memo } from 'react'
import { ScrollView, TouchableOpacity, View, Platform, StyleSheet } from 'react-native'
import { BlurView } from '@react-native-community/blur'
import { useI18n } from '@/lang'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { confirmDialog, createStyle, exitApp as backHome } from '@/utils/tools'
import { NAV_MENUS, COMPONENT_IDS } from '@/config/constant'
import type { InitState } from '@/store/common/state'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { exitApp, setNavActiveId } from '@/core/common'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'

const styles = createStyle({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    textAlign: 'center',
    marginLeft: 16,
  },
  menus: {
    flex: 1,
  },
  list: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  menuItemWrapper: {
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    alignItems: 'center',
  },
  menuItemActive: {
    backgroundColor: 'rgba(0,122,255,0.15)',
  },
  iconContent: {
    width: 24,
    alignItems: 'center',
  },
  text: {
    paddingLeft: 16,
    fontSize: 15,
  },
})

const GlassMenuItem = ({ id, icon, onPress, active }: {
  id: any
  icon: string
  onPress: (id: any) => void
  active: boolean
}) => {
  const t = useI18n()
  const theme = useTheme()

  const content = (
    <View style={[styles.menuItem, active && styles.menuItemActive]}>
      <View style={styles.iconContent}>
        <Icon name={icon} size={20} color={active ? theme['c-primary'] : theme['c-font-label']} />
      </View>
      <Text style={styles.text} color={active ? theme['c-primary'] : theme['c-text']}>{t(id)}</Text>
    </View>
  )

  if (Platform.OS !== 'ios') {
    return (
      <TouchableOpacity style={[styles.menuItemWrapper, { backgroundColor: active ? 'rgba(0,122,255,0.15)' : 'rgba(255,255,255,0.5)' }]} onPress={() => onPress(id)} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity style={styles.menuItemWrapper} onPress={() => onPress(id)} activeOpacity={0.8}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="light"
        blurAmount={15}
        reducedTransparencyFallbackColor="rgba(255,255,255,0.6)"
      />
      <View style={[StyleSheet.absoluteFill, { borderRadius: 14, borderWidth: 1, borderColor: active ? 'rgba(0,122,255,0.4)' : 'rgba(255,255,255,0.4)' }]} pointerEvents="none" />
      {content}
    </TouchableOpacity>
  )
}

const Header = () => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  return (
    <View style={{ paddingTop: statusBarHeight, backgroundColor: theme['c-primary-light-700-alpha-500'] }}>
      <View style={styles.header}>
        <Icon name="logo" color={theme['c-primary-dark-100-alpha-300']} size={28} />
        <Text style={styles.headerText} size={28} color={theme['c-primary-dark-100-alpha-300']}>LX Music</Text>
      </View>
    </View>
  )
}

type IdType = InitState['navActiveId'] | 'nav_exit' | 'back_home'

export default memo(() => {
  const theme = useTheme()
  const activeId = useNavActiveId()
  const showBackBtn = useSettingValue('common.showBackBtn')
  const showExitBtn = useSettingValue('common.showExitBtn')

  const handlePress = (id: IdType) => {
    switch (id) {
      case 'nav_exit':
        void confirmDialog({
          message: global.i18n.t('exit_app_tip'),
          confirmButtonText: global.i18n.t('list_remove_tip_button'),
        }).then(isExit => {
          if (!isExit) return
          exitApp('Exit Btn')
        })
        return
      case 'back_home':
        backHome()
        return
    }

    if (id === 'download') {
      global.app_event.changeMenuVisible(false)
      const componentId = commonState.componentIds.home
      if (componentId) navigations.pushDownloadScreen(componentId)
      return
    }
    global.app_event.changeMenuVisible(false)
    setNavActiveId(id)
  }

  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      <Header />
      <ScrollView style={styles.menus}>
        <View style={styles.list}>
          {NAV_MENUS.map(menu => (
            <GlassMenuItem key={menu.id} id={menu.id} icon={menu.icon} onPress={handlePress} active={activeId == menu.id} />
          ))}
        </View>
      </ScrollView>
      {
        showBackBtn ? <View style={{ paddingHorizontal: 12, marginBottom: 8 }}><GlassMenuItem id="back_home" icon="home" onPress={handlePress} active={false} /></View> : null
      }
      {
        showExitBtn ? <View style={{ paddingHorizontal: 12, marginBottom: 8 }}><GlassMenuItem id="nav_exit" icon="exit2" onPress={handlePress} active={false} /></View> : null
      }
    </View>
  )
})
