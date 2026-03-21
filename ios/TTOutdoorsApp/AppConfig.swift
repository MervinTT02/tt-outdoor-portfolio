import Foundation

enum AppConfig {
  // 必须是直接返回 JSON 的完整地址（不要填 /admin 页面地址）
  static let siteConfigURL = URL(string: "https://ttontheway.xyz/site-config.json")!

  // 图片资源根地址
  static let assetsBaseURL = URL(string: "https://ttontheway.xyz")!
  // 如果线上已经发布了 thumbs 目录可改为 true
  static let enableServerThumbnails = false

  private static func normalizeAssetPath(_ rawPath: String) -> String {
    rawPath
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: "./", with: "")
      .replacingOccurrences(of: "\\", with: "/")
  }

  static func absoluteAssetURL(from rawPath: String) -> URL? {
    let trimmed = rawPath.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }

    if let direct = URL(string: trimmed), direct.scheme != nil {
      return direct
    }

    let normalized = normalizeAssetPath(trimmed)

    return assetsBaseURL.appending(path: normalized)
  }

  static func candidateAssetURLs(from rawPath: String) -> [URL] {
    let trimmed = rawPath.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return [] }

    if let direct = URL(string: trimmed), direct.scheme != nil {
      return [direct]
    }

    let normalized = normalizeAssetPath(trimmed)
    guard !normalized.isEmpty else { return [] }

    var results: [URL] = []

    if let u1 = absoluteAssetURL(from: normalized) {
      results.append(u1)
    }

    let base = assetsBaseURL.absoluteString.hasSuffix("/")
      ? String(assetsBaseURL.absoluteString.dropLast())
      : assetsBaseURL.absoluteString
    let rawPath = "/" + normalized

    if let u2 = URL(string: base + rawPath) {
      results.append(u2)
    }

    if let encodedPath = rawPath.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
       let u3 = URL(string: base + encodedPath) {
      results.append(u3)
    }

    var seen = Set<String>()
    return results.filter { seen.insert($0.absoluteString).inserted }
  }

  static func thumbnailAssetURL(from rawPath: String, maxPixel: Int) -> URL? {
    let normalized = normalizeAssetPath(rawPath)
    guard !normalized.isEmpty else { return nil }
    if URL(string: normalized)?.scheme != nil { return nil }

    let ext = (normalized as NSString).pathExtension.lowercased()
    guard ext == "jpg" || ext == "jpeg" || ext == "png" || ext == "webp" || ext == "heic" else {
      return nil
    }

    let noExt = (normalized as NSString).deletingPathExtension
    let thumbPath = "thumbs/\(noExt)-w\(maxPixel).jpg"
    return assetsBaseURL.appending(path: thumbPath)
  }
}
