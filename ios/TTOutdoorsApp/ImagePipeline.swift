import Foundation
import ImageIO
import UIKit

actor ImagePipeline {
  static let shared = ImagePipeline()

  private let session: URLSession
  private let memoryCache = NSCache<NSURL, UIImage>()
  private var inFlightTasks: [NSURL: Task<UIImage, Error>] = [:]

  init() {
    let config = URLSessionConfiguration.default
    config.requestCachePolicy = .returnCacheDataElseLoad
    config.urlCache = URLCache(
      memoryCapacity: 100 * 1024 * 1024,
      diskCapacity: 500 * 1024 * 1024,
      diskPath: "tt_image_cache"
    )
    config.timeoutIntervalForRequest = 30
    config.timeoutIntervalForResource = 120
    self.session = URLSession(configuration: config)

    memoryCache.countLimit = 400
    memoryCache.totalCostLimit = 120 * 1024 * 1024
  }

  func image(for url: URL, maxPixel: CGFloat?) async throws -> UIImage {
    let key = url as NSURL
    if let cached = memoryCache.object(forKey: key) {
      return cached
    }

    if let running = inFlightTasks[key] {
      return try await running.value
    }

    let task = Task<UIImage, Error> {
      var request = URLRequest(url: url)
      request.cachePolicy = .returnCacheDataElseLoad

      let (data, response) = try await session.data(for: request)
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        throw URLError(.badServerResponse)
      }

      if let http = response as? HTTPURLResponse {
        let contentType = (http.value(forHTTPHeaderField: "Content-Type") ?? "").lowercased()
        if !contentType.hasPrefix("image/") {
          throw URLError(.cannotDecodeContentData)
        }
      }

      guard let image = Self.decodeImage(from: data, maxPixel: maxPixel), image.size != .zero else {
        throw URLError(.cannotDecodeContentData)
      }
      return image
    }

    inFlightTasks[key] = task

    do {
      let image = try await task.value
      let cost = Int(image.size.width * image.size.height * image.scale * image.scale)
      memoryCache.setObject(image, forKey: key, cost: max(cost, 1))
      inFlightTasks[key] = nil
      return image
    } catch {
      inFlightTasks[key] = nil
      throw error
    }
  }

  nonisolated private static func decodeImage(from data: Data, maxPixel: CGFloat?) -> UIImage? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil) else {
      return UIImage(data: data)
    }

    var options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCacheImmediately: true,
      kCGImageSourceCreateThumbnailFromImageAlways: true,
    ]

    if let maxPixel, maxPixel > 0 {
      options[kCGImageSourceThumbnailMaxPixelSize] = Int(maxPixel)
    }

    if let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) {
      return UIImage(cgImage: cgImage)
    }

    return UIImage(data: data)
  }
}
