import Foundation

struct SiteConfig: Decodable {
  let site: SiteInfo?
  let routes: [Route]
}

struct SiteInfo: Decodable {
  let brandText: String?
  let aboutTitle: String?
  let aboutText: String?
}

struct Route: Decodable, Identifiable {
  let id: String
  let name: String
  let location: String?
  let effort: String?
  let highlight: String?
  let cover: String?
  let photos: [String]
}
