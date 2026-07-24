import Foundation

/// Plain-text projection of a transcript message: exactly what the reader sees
/// in the bubble, with tool traces and non-text blocks removed. Shared by the
/// transcript exporter and the Listen action so exported and spoken text
/// always match the visible transcript.
enum ChatMessageVisibleText {
    static func copyText(in message: LuckyNemoChatMessage) -> String {
        let role = message.role.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return role == "assistant" ? self.visibleText(in: message) : self.primaryText(in: message)
    }

    static func visibleText(in message: LuckyNemoChatMessage) -> String {
        let text = self.primaryText(in: message)
        let role = message.role.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard role != "user" else { return text }
        return AssistantTextParser.visibleSegments(from: text)
            .map(\.text)
            .joined(separator: "\n\n")
    }

    static func hasVisibleText(in message: LuckyNemoChatMessage) -> Bool {
        !self.visibleText(in: message)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .isEmpty
    }

    private static func primaryText(in message: LuckyNemoChatMessage) -> String {
        let parts = message.content.compactMap { content -> String? in
            let kind = (content.type ?? "text").lowercased()
            guard kind == "text" || kind.isEmpty else { return nil }
            return content.text
        }
        return LuckyNemoChatMessage.displayText(
            contentText: parts.joined(separator: "\n"),
            role: message.role,
            stopReason: message.stopReason,
            errorMessage: message.errorMessage)
    }
}
