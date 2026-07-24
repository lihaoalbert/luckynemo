import Foundation

public enum LuckyNemoSystemCommand: String, Codable, Sendable {
    case run = "system.run"
    case which = "system.which"
    case notify = "system.notify"
    case execApprovalsGet = "system.execApprovals.get"
    case execApprovalsSet = "system.execApprovals.set"
}

public enum LuckyNemoFileSystemCommand: String, Codable, Sendable {
    case listDir = "fs.listDir"
}

public enum LuckyNemoNotificationPriority: String, Codable, Sendable {
    case passive
    case active
    case timeSensitive
}

public enum LuckyNemoNotificationDelivery: String, Codable, Sendable {
    case system
    case overlay
    case auto
}

public struct LuckyNemoSystemNotifyParams: Codable, Sendable, Equatable {
    public var title: String
    public var body: String
    public var sound: String?
    public var priority: LuckyNemoNotificationPriority?
    public var delivery: LuckyNemoNotificationDelivery?

    public init(
        title: String,
        body: String,
        sound: String? = nil,
        priority: LuckyNemoNotificationPriority? = nil,
        delivery: LuckyNemoNotificationDelivery? = nil)
    {
        self.title = title
        self.body = body
        self.sound = sound
        self.priority = priority
        self.delivery = delivery
    }
}
