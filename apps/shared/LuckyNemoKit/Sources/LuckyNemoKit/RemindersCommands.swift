import Foundation

public enum LuckyNemoRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum LuckyNemoReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct LuckyNemoRemindersListParams: Codable, Sendable, Equatable {
    public var status: LuckyNemoReminderStatusFilter?
    public var limit: Int?

    public init(status: LuckyNemoReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct LuckyNemoRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct LuckyNemoReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct LuckyNemoRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [LuckyNemoReminderPayload]

    public init(reminders: [LuckyNemoReminderPayload]) {
        self.reminders = reminders
    }
}

public struct LuckyNemoRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: LuckyNemoReminderPayload

    public init(reminder: LuckyNemoReminderPayload) {
        self.reminder = reminder
    }
}
