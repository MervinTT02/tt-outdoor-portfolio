import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
  @Published private(set) var routes: [Route] = []
  @Published private(set) var siteInfo: SiteInfo?
  @Published private(set) var loading = false
  @Published private(set) var errorText: String?

  private let client: APIClient

  init(client: APIClient = APIClient()) {
    self.client = client
  }

  func load() async {
    loading = true
    errorText = nil
    defer { loading = false }

    do {
      let config = try await client.fetchSiteConfig()
      siteInfo = config.site
      routes = config.routes
    } catch is CancellationError {
      // 下拉刷新或视图切换时，请求被系统取消属于正常行为，不提示错误。
      return
    } catch let urlError as URLError where urlError.code == .cancelled {
      // URLSession 层的取消也视为正常中断。
      return
    } catch {
      print("[HomeViewModel] load failed: \(error.localizedDescription)")
      errorText = "加载失败：\(error.localizedDescription)"
    }
  }
}
