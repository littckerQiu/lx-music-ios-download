<p align="center"><img width="200" src="https://github.com/lyswhut/lx-music-mobile/blob/master/doc/images/icon.png" alt="lx-music logo"></p>

<h1 align="center">LX Music iOS 增强版</h1>

<p align="center">
  基于 <a href="https://github.com/lyswhut/lx-music-mobile">洛雪音乐</a> 的 iOS 适配二次开发版本
</p>

## 项目说明

本项目是基于 [洛雪音乐移动版](https://github.com/lyswhut/lx-music-mobile) 的 iOS 适配增强版。

- **上游项目**：[lyswhut/lx-music-mobile](https://github.com/lyswhut/lx-music-mobile)（Apache License 2.0）
- **iOS 适配基础**：[Q-1515/lx-music-mobile (ios-adaptation 分支)](https://github.com/Q-1515/lx-music-mobile/tree/ios-adaptation)
- **本仓库**：在 iOS 适配基础上增加下载和多选导出等功能

> ⚠️ 本项目为社区二次开发，与洛雪音乐官方无关。官方目前没有计划支持 iOS。

## 新增功能

在原版洛雪音乐基础上，本版本增加了以下功能：

### 下载功能
- 歌曲列表菜单中新增「下载」选项
- 多选模式下支持批量下载
- 下载管理器支持：
  - 下载中 / 下载失败 / 下载完成 分类查看
  - 暂停 / 继续 / 重试 / 删除 单个任务
  - 全部暂停 / 全部开始 / 清除记录
  - 任务持久化，退出重进不丢失
  - 自动保存歌词（.lrc）和封面图片
  - 顺序下载避免音源限流
  - 自动切换音源、URL 过期自动刷新

### 导出功能
- 下载完成页长按进入多选模式
- 选中后可导出为 ZIP 包（包含音乐 + 歌词 + 封面）
- 通过系统分享面板选择保存位置

### 播放增强
- 已完成下载的音乐可在下载列表中单击直接播放

## 技术栈

- React Native
- iOS 原生开发
- react-native-fs（文件下载）
- jszip（打包导出）

## 编译

本项目通过 GitHub Actions 自动编译未签名 IPA。

1. Fork 本仓库
2. 推送代码后自动触发编译
3. 在 Actions 页面下载编译产物

手动编译：
```bash
npm install
cd ios && pod install
xcodebuild -workspace LxMusicMobile.xcworkspace -scheme LxMusicMobile -configuration Release -sdk iphoneos build
```

## 安装

未签名 IPA 需要通过以下方式侧载：
- Sideloadly
- TrollStore
- AltStore
- 自签名后通过 Xcode 安装

## 许可证

本项目基于 Apache License 2.0 开源，保留原作者版权声明。

```
Copyright 2024 lyswhut

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## 致谢

- [洛雪音乐](https://github.com/lyswhut/lx-music-mobile) - 原版项目
- [Q-1515](https://github.com/Q-1515/lx-music-mobile) - iOS 适配基础
- 所有开源贡献者
