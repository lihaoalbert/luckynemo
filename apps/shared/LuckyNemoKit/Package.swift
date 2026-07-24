// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "LuckyNemoKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
        .watchOS(.v11),
    ],
    products: [
        .library(name: "LuckyNemoProtocol", targets: ["LuckyNemoProtocol"]),
        .library(name: "LuckyNemoKit", targets: ["LuckyNemoKit"]),
        .library(name: "LuckyNemoChatUI", targets: ["LuckyNemoChatUI"]),
    ],
    traits: [
        .trait(name: "Talk", description: "ElevenLabs cloud TTS / talk support"),
        .default(enabledTraits: ["Talk"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.1"),
        .package(url: "https://github.com/mgriebling/SwiftMath", exact: "1.7.3"),
        .package(url: "https://github.com/swiftlang/swift-markdown", exact: "0.8.0"),
    ],
    targets: [
        .target(
            name: "LuckyNemoProtocol",
            path: "Sources/LuckyNemoProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "LuckyNemoKit",
            dependencies: [
                "LuckyNemoProtocol",
                .product(
                    name: "ElevenLabsKit",
                    package: "ElevenLabsKit",
                    condition: .when(platforms: [.iOS, .macOS], traits: ["Talk"])),
            ],
            path: "Sources/LuckyNemoKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "LuckyNemoChatUI",
            dependencies: [
                "LuckyNemoKit",
                "LuckyNemoProtocol",
                .product(name: "Markdown", package: "swift-markdown"),
                .product(name: "SwiftMath", package: "SwiftMath"),
            ],
            path: "Sources/LuckyNemoChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "LuckyNemoKitTests",
            dependencies: ["LuckyNemoKit", "LuckyNemoChatUI", "LuckyNemoProtocol"],
            path: "Tests/LuckyNemoKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])