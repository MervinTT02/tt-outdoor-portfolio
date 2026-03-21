import Foundation

final class APIClient {
  private let session: URLSession

  init(session: URLSession = .shared) {
    self.session = session
  }

  func fetchSiteConfig() async throws -> SiteConfig {
    let (data, response) = try await session.data(from: AppConfig.siteConfigURL)
    guard let http = response as? HTTPURLResponse else {
      throw APIClientError.invalidResponse
    }

    guard (200...299).contains(http.statusCode) else {
      throw APIClientError.httpStatus(code: http.statusCode, bodyPreview: Self.previewText(from: data))
    }

    let decoder = JSONDecoder()

    do {
      return try decoder.decode(SiteConfig.self, from: data)
    } catch {
      // 兼容常见包裹格式：{ "data": { ...siteConfig... } } 或 { "config": { ... } }
      if let wrapped = try? decoder.decode(SiteConfigWrappedResponse.self, from: data),
         let config = wrapped.data ?? wrapped.config {
        return config
      }

      throw APIClientError.decodingFailed(
        underlying: error.localizedDescription,
        bodyPreview: Self.previewText(from: data)
      )
    }
  }

  private static func previewText(from data: Data, limit: Int = 220) -> String {
    let raw = String(decoding: data, as: UTF8.self)
    if raw.isEmpty { return "<empty>" }
    let compact = raw.replacingOccurrences(of: "\n", with: " ").replacingOccurrences(of: "\t", with: " ")
    return String(compact.prefix(limit))
  }
}

private struct SiteConfigWrappedResponse: Decodable {
  let data: SiteConfig?
  let config: SiteConfig?
}

enum APIClientError: LocalizedError {
  case invalidResponse
  case httpStatus(code: Int, bodyPreview: String)
  case decodingFailed(underlying: String, bodyPreview: String)

  var errorDescription: String? {
    switch self {
    case .invalidResponse:
      return "后端返回异常：无法识别响应。"
    case .httpStatus(let code, let bodyPreview):
      return "请求失败（HTTP \(code)）。响应片段：\(bodyPreview)"
    case .decodingFailed(let underlying, let bodyPreview):
      return "数据解析失败：\(underlying)。响应片段：\(bodyPreview)"
    }
  }
}
