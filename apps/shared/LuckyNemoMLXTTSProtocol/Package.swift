// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "LuckyNemoMLXTTSProtocol",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "LuckyNemoMLXTTSProtocol", targets: ["LuckyNemoMLXTTSProtocol"]),
    ],
    targets: [
        .target(name: "LuckyNemoMLXTTSProtocol"),
        .testTarget(
            name: "LuckyNemoMLXTTSProtocolTests",
            dependencies: ["LuckyNemoMLXTTSProtocol"]),
    ])
