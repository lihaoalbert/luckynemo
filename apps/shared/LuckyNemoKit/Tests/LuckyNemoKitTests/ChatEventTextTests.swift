import Foundation
import LuckyNemoKit
import Testing
@testable import LuckyNemoChatUI

struct ChatEventTextTests {
    @Test func `decodes v3 and v4 chat delta payloads`() throws {
        let payloads = [
            #"{"runId":"run-v3","sessionKey":"main","state":"delta","message":{"role":"assistant","content":[{"type":"text","text":"v3 reply"}]}}"#,
            #"{"runId":"run-v4","sessionKey":"main","state":"delta","deltaText":"reply","message":{"role":"assistant","content":[{"type":"text","text":"v4 reply"}]}}"#,
        ]

        let decoded = try payloads.map { payload in
            try JSONDecoder().decode(LuckyNemoChatEventPayload.self, from: Data(payload.utf8))
        }

        #expect(
            decoded.map { LuckyNemoChatEventText.assistantText(from: $0) } ==
                ["v3 reply", "v4 reply"])
    }

    @Test func `extracts assistant text from final chat event message`() {
        let event = LuckyNemoChatEventPayload(
            runId: "run-1",
            sessionKey: "main",
            state: "final",
            message: AnyCodable([
                "role": "assistant",
                "content": [
                    ["type": "text", "text": "hello"],
                    ["type": "text", "text": "world"],
                ],
            ]),
            errorMessage: nil)

        #expect(LuckyNemoChatEventText.assistantText(from: event) == "hello\nworld")
    }

    @Test func `ignores user messages`() {
        let event = LuckyNemoChatEventPayload(
            runId: "run-1",
            sessionKey: "main",
            state: "delta",
            message: AnyCodable([
                "role": "user",
                "content": [["type": "text", "text": "ignore me"]],
            ]),
            errorMessage: nil)

        #expect(LuckyNemoChatEventText.assistantText(from: event) == nil)
    }

    @Test func `extracts plain string content`() {
        let event = LuckyNemoChatEventPayload(
            runId: "run-1",
            sessionKey: "main",
            state: "final",
            message: AnyCodable([
                "role": "assistant",
                "content": "plain reply",
            ]),
            errorMessage: nil)

        #expect(LuckyNemoChatEventText.assistantText(from: event) == "plain reply")
    }
}
