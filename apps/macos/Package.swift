// swift-tools-version: 6.2
// Package manifest for the LuckyNemo macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "LuckyNemo",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "LuckyNemoIPC", targets: ["LuckyNemoIPC"]),
        .library(name: "LuckyNemoDiscovery", targets: ["LuckyNemoDiscovery"]),
        .executable(name: "LuckyNemo", targets: ["LuckyNemo"]),
        .executable(name: "luckynemo-mac", targets: ["LuckyNemoMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/sindresorhus/KeyboardShortcuts", exact: "3.0.1"),
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.3.0"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.4.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.12.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.9.0"),
        .package(url: "https://github.com/steipete/Peekaboo.git", exact: "3.9.3"),
        .package(url: "https://github.com/pointfreeco/swift-concurrency-extras", from: "1.3.1"),
        .package(path: "../shared/LuckyNemoKit"),
        .package(path: "../shared/LuckyNemoMLXTTSProtocol"),
        .package(path: "../swabble"),
    ],
    targets: [
        .target(
            name: "LuckyNemoIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "LuckyNemoDiscovery",
            dependencies: [
                .product(name: "LuckyNemoKit", package: "LuckyNemoKit"),
            ],
            path: "Sources/LuckyNemoDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "LuckyNemo",
            dependencies: [
                "LuckyNemoIPC",
                "LuckyNemoDiscovery",
                .product(name: "LuckyNemoKit", package: "LuckyNemoKit"),
                .product(name: "LuckyNemoChatUI", package: "LuckyNemoKit"),
                .product(name: "LuckyNemoMLXTTSProtocol", package: "LuckyNemoMLXTTSProtocol"),
                .product(name: "LuckyNemoProtocol", package: "LuckyNemoKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
                .product(name: "ConcurrencyExtras", package: "swift-concurrency-extras"),
                .product(name: "KeyboardShortcuts", package: "KeyboardShortcuts"),
            ],
            exclude: [
                "Resources/Info.plist",
                "Resources/Localizable.xcstrings",
            ],
            resources: [
                .copy("Resources/LuckyNemo.icns"),
                .copy("Resources/DeviceModels"),
                .copy("Resources/ProviderIcons"),
                .copy("Resources/install-cli.sh"),
                .copy("Resources/luckynemo-hero.png"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "LuckyNemoMacCLI",
            dependencies: [
                "LuckyNemoDiscovery",
                .product(name: "LuckyNemoKit", package: "LuckyNemoKit"),
                .product(name: "LuckyNemoProtocol", package: "LuckyNemoKit"),
            ],
            path: "Sources/LuckyNemoMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "LuckyNemoIPCTests",
            dependencies: [
                "LuckyNemoIPC",
                "LuckyNemo",
                "LuckyNemoMacCLI",
                "LuckyNemoDiscovery",
                .product(name: "LuckyNemoChatUI", package: "LuckyNemoKit"),
                .product(name: "LuckyNemoKit", package: "LuckyNemoKit"),
                .product(name: "LuckyNemoMLXTTSProtocol", package: "LuckyNemoMLXTTSProtocol"),
                .product(name: "LuckyNemoProtocol", package: "LuckyNemoKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
