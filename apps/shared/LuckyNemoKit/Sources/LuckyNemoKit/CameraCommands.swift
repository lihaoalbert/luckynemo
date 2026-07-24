import Foundation

public enum LuckyNemoCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum LuckyNemoCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum LuckyNemoCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum LuckyNemoCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct LuckyNemoCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: LuckyNemoCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: LuckyNemoCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: LuckyNemoCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: LuckyNemoCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct LuckyNemoCameraClipParams: Codable, Sendable, Equatable {
    public var facing: LuckyNemoCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: LuckyNemoCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: LuckyNemoCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: LuckyNemoCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
