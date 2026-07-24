import Foundation

public enum LuckyNemoDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum LuckyNemoBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum LuckyNemoThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum LuckyNemoNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum LuckyNemoNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct LuckyNemoBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: LuckyNemoBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: LuckyNemoBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct LuckyNemoThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: LuckyNemoThermalState

    public init(state: LuckyNemoThermalState) {
        self.state = state
    }
}

public struct LuckyNemoStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct LuckyNemoNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: LuckyNemoNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [LuckyNemoNetworkInterfaceType]

    public init(
        status: LuckyNemoNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [LuckyNemoNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct LuckyNemoDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: LuckyNemoBatteryStatusPayload
    public var thermal: LuckyNemoThermalStatusPayload
    public var storage: LuckyNemoStorageStatusPayload
    public var network: LuckyNemoNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: LuckyNemoBatteryStatusPayload,
        thermal: LuckyNemoThermalStatusPayload,
        storage: LuckyNemoStorageStatusPayload,
        network: LuckyNemoNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct LuckyNemoDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
