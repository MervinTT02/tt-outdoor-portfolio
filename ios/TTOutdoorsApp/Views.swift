import SwiftUI
import UIKit

struct HomeView: View {
  @StateObject private var vm = HomeViewModel()

  var body: some View {
    NavigationStack {
      Group {
        if vm.routes.isEmpty {
          if vm.loading {
            ProgressView("正在加载")
          } else if let error = vm.errorText {
            VStack(spacing: 12) {
              Text(error)
                .font(.subheadline)
                .foregroundStyle(.red)
              Button("重试") {
                Task { await vm.load() }
              }
            }
            .padding(24)
          } else {
            VStack(spacing: 8) {
              Image(systemName: "tray")
                .font(.title2)
                .foregroundStyle(.secondary)
              Text("暂无数据")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
            .padding(24)
          }
        } else {
          ZStack(alignment: .bottom) {
            List(vm.routes) { route in
              NavigationLink {
                RouteDetailView(route: route)
              } label: {
                RouteRow(route: route)
              }
            }
            .listStyle(.plain)

            if let error = vm.errorText {
              Text(error)
                .font(.footnote)
                .foregroundStyle(.red)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(.bottom, 12)
            }
          }
        }
      }
      .navigationTitle(vm.siteInfo?.brandText ?? "TT Outdoors")
      .task {
        guard vm.routes.isEmpty else { return }
        await vm.load()
      }
      .refreshable {
        await vm.load()
      }
    }
  }
}

private struct RouteRow: View {
  let route: Route

  var body: some View {
    HStack(spacing: 12) {
      RemoteImage(rawPath: route.cover, maxPixel: 360, preferThumbnail: AppConfig.enableServerThumbnails)
        .frame(width: 92, height: 70)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

      VStack(alignment: .leading, spacing: 4) {
        Text(route.name)
          .font(.headline)
          .lineLimit(2)

        if let location = route.location, !location.isEmpty {
          Label(location, systemImage: "mappin.and.ellipse")
            .font(.footnote)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }

        if let effort = route.effort, !effort.isEmpty {
          Text(effort)
            .font(.footnote)
            .foregroundStyle(.secondary)
            .lineLimit(1)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.vertical, 4)
  }
}

struct RouteDetailView: View {
  let route: Route
  private let columns = [
    GridItem(.flexible(), spacing: 12),
    GridItem(.flexible(), spacing: 12),
  ]
  private let photoCardHeight: CGFloat = 148

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        RemoteImage(rawPath: route.cover, maxPixel: 1280, preferThumbnail: AppConfig.enableServerThumbnails)
          .frame(maxWidth: .infinity)
          .frame(height: 220)
          .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        if let highlight = route.highlight, !highlight.isEmpty {
          Text(highlight)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        LazyVGrid(columns: columns, spacing: 12) {
          ForEach(Array(route.photos.enumerated()), id: \.offset) { _, path in
            RemoteImage(rawPath: path, maxPixel: 760, preferThumbnail: AppConfig.enableServerThumbnails)
              .frame(maxWidth: .infinity, minHeight: photoCardHeight, maxHeight: photoCardHeight)
              .clipped()
              .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
          }
        }
      }
      .padding(14)
    }
    .navigationTitle(route.name)
    .navigationBarTitleDisplayMode(.inline)
  }
}

private struct RemoteImage: View {
  let rawPath: String?
  let maxPixel: CGFloat?
  let preferThumbnail: Bool

  @State private var loadedImage: UIImage?
  @State private var loadedKey: String?
  @State private var isLoading = false
  @State private var isFailed = false
  @State private var loadingTask: Task<Void, Never>?
  private static let imageSession: URLSession = {
    let config = URLSessionConfiguration.default
    config.requestCachePolicy = .returnCacheDataElseLoad
    config.timeoutIntervalForRequest = 60
    config.timeoutIntervalForResource = 180
    config.waitsForConnectivity = true
    config.allowsExpensiveNetworkAccess = true
    config.allowsConstrainedNetworkAccess = true
    config.httpMaximumConnectionsPerHost = 4
    config.urlCache = URLCache(
      memoryCapacity: 80 * 1024 * 1024,
      diskCapacity: 300 * 1024 * 1024,
      diskPath: "tt_remote_image_cache_v2"
    )
    return URLSession(configuration: config)
  }()

  var body: some View {
    Group {
      if let text = rawPath,
         let url = AppConfig.absoluteAssetURL(from: text) {
        Group {
          if let image = loadedImage {
            Image(uiImage: image)
              .resizable()
              .scaledToFill()
          } else if isFailed {
            fallback
          } else if isLoading {
            ProgressView()
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          } else {
            Color(.secondarySystemBackground)
              .frame(maxWidth: .infinity, maxHeight: .infinity)
          }
        }
        .onAppear {
          triggerLoad(for: text)
        }
        .onChange(of: url) { _ in
          triggerLoad(for: text)
        }
        .onDisappear {
          loadingTask?.cancel()
        }
      } else {
        fallback
      }
    }
    .background(Color(.secondarySystemBackground))
  }

  private var fallback: some View {
    Image(systemName: "photo")
      .font(.title3)
      .foregroundStyle(.secondary)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(Color(.secondarySystemBackground))
  }

  @MainActor
  private func triggerLoad(for raw: String) {
    let key = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !key.isEmpty else { return }

    if loadedKey != key {
      loadedKey = key
      loadedImage = nil
      isFailed = false
    }
    if loadedImage != nil { return }

    loadingTask?.cancel()
    loadingTask = Task {
      await loadImage(raw)
    }
  }

  @MainActor
  private func loadImage(_ raw: String) async {
    isLoading = true
    defer { isLoading = false }

    let urls = AppConfig.candidateAssetURLs(from: raw)
    guard !urls.isEmpty else {
      isFailed = true
      return
    }

    for candidate in urls {
      if Task.isCancelled { return }
      for attempt in 1...2 {
        if Task.isCancelled { return }
        var request = URLRequest(url: candidate)
        request.timeoutInterval = 60
        request.cachePolicy = .returnCacheDataElseLoad

        do {
          let (data, response) = try await Self.imageSession.data(for: request)
          guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            break
          }
          if let contentType = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Type"),
             !contentType.lowercased().hasPrefix("image/") {
            break
          }
          if let image = UIImage(data: data), image.size != .zero {
            loadedImage = image
            return
          }
          break
        } catch is CancellationError {
          return
        } catch let urlError as URLError {
          let retriable = urlError.code == .timedOut || urlError.code == .networkConnectionLost
          if retriable && attempt == 1 {
            continue
          }
          break
        } catch {
          break
        }
      }
    }

    isFailed = true
  }
}
