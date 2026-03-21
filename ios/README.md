# iPhone App 接入说明（SwiftUI）

已生成完整 Xcode 工程，可直接打开：`ios/TTOutdoorsApp.xcodeproj`

## 1. 改后端地址

打开：`ios/TTOutdoorsApp/AppConfig.swift`

确保这两个地址正确：

```swift
static let siteConfigURL = URL(string: "https://your-domain.com/site-config.json")!
static let assetsBaseURL = URL(string: "https://your-domain.com")!
```

要求：
- `siteConfigURL` 必须直接返回 JSON，不要填成 `/admin` 或首页 URL
- `assetsBaseURL` 用于图片资源路径（例如 `./个人摄影集/...`）
- 建议使用 `https`

## 2. 打开并运行

1. 双击打开 `ios/TTOutdoorsApp.xcodeproj`
2. 选择 `TTOutdoorsApp` Scheme
3. 选 iPhone 模拟器或真机运行

## 3. 当前功能

- 从后端拉取 `site-config.json`
- 展示路线列表
- 进入路线详情查看照片
- 下拉刷新
- 加载失败与空图兜底
- 缩略图优先加载（`thumbs/...-w360/760/1280.jpg`），失败自动回退原图

## 4. 生成缩略图（强烈建议）

在仓库根目录执行：

```bash
ios/scripts/generate_thumbs.sh
```

会在根目录生成 `thumbs/`，请和原图一起发布到线上。  
没有 `thumbs/` 时，App 会回退加载原图，速度会明显慢很多。

## 5. 已生成的工程文件

- `ios/TTOutdoorsApp.xcodeproj/project.pbxproj`
- `ios/TTOutdoorsApp.xcodeproj/project.xcworkspace/contents.xcworkspacedata`
- `ios/TTOutdoorsApp.xcodeproj/xcshareddata/xcschemes/TTOutdoorsApp.xcscheme`
- `ios/TTOutdoorsApp/Info.plist`

## 6. 说明

当前机器的 `xcodebuild` 运行环境存在插件缺失（本地 Xcode 安装问题），所以没法在命令行完成构建验证。
工程文件语法已通过本地静态校验（`plutil` / `xmllint`）。
