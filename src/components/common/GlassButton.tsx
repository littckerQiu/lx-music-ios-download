import React from 'react'
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { BlurView } from '@react-native-community/blur'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'

interface GlassButtonProps {
  children: React.ReactNode
  onPress?: () => void
  active?: boolean
  style?: any
  textStyle?: any
  icon?: React.ReactNode
}

export default ({ children, onPress, active = false, style, textStyle, icon }: GlassButtonProps) => {
  const theme = useTheme()

  const content = (
    <View style={[styles.content, style]}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      {typeof children === 'string' ? (
        <Text color={active ? theme['c-primary'] : theme['c-text']} style={[styles.text, textStyle]}>
          {children}
        </Text>
      ) : children}
    </View>
  )

  if (Platform.OS !== 'ios') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.androidFallback, active && styles.androidActive]}>
        {content}
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="light"
        blurAmount={20}
        reducedTransparencyFallbackColor="rgba(255,255,255,0.6)"
      />
      <View style={[styles.border, active && styles.borderActive]} pointerEvents="none" />
      {content}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  borderActive: {
    borderColor: 'rgba(0,122,255,0.6)',
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  androidFallback: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  androidActive: {
    backgroundColor: 'rgba(0,122,255,0.2)',
    borderColor: 'rgba(0,122,255,0.5)',
  },
})
