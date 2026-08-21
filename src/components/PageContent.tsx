import { Platform, SafeAreaView, StyleSheet, View } from 'react-native'
import { BlurView } from '@react-native-community/blur'
import { useTheme } from '@/store/theme/hook'
import ImageBackground from '@/components/common/ImageBackground'
import { useWindowSize } from '@/utils/hooks'
import { useMemo } from 'react'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import { useBgPic } from '@/store/common/hook'

interface Props {
  children: React.ReactNode
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)

const ContentContainer = ({ children }: Props) => {
  if (Platform.OS == 'ios') return <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
  return <>{children}</>
}

export default ({ children }: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  const pic = useBgPic()

  const themeComponent = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
        source={theme['bg-image']}
        resizeMode="cover"
      />
      {Platform.OS === 'ios' ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="systemMaterial"
          blurAmount={35}
          reducedTransparencyFallbackColor={theme['c-main-background']}
        />
      ) : (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme['c-main-background'],
              opacity: 0.7,
            },
          ]}
        />
      )}
      <ContentContainer>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {children}
        </View>
      </ContentContainer>
    </View>
  ), [children, theme, windowSize.height, windowSize.width])

  const picComponent = useMemo(() => {
    return (
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ImageBackground
          style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height, width: windowSize.width, backgroundColor: theme['c-content-background'] }}
          source={{ uri: pic!, headers: defaultHeaders }}
          resizeMode="cover"
        />
        {Platform.OS === 'ios' ? (
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="systemMaterial"
            blurAmount={30}
            reducedTransparencyFallbackColor={theme['c-content-background']}
          />
        ) : (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: theme['c-content-background'],
                opacity: 0.6,
              },
            ]}
          />
        )}
        <ContentContainer>
          <View style={{ flex: 1, flexDirection: 'column' }}>
            {children}
          </View>
        </ContentContainer>
      </View>
    )
  }, [children, pic, theme, windowSize.height, windowSize.width])

  return (
    <>
      <SizeView />
      {pic ? picComponent : themeComponent}
    </>
  )
}
