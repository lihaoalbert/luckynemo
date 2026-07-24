import Foundation
import LuckyNemoProtocol
import Testing
@testable import LuckyNemoChatUI

@MainActor
private func questionRecord(
    multiSelect: Bool = false,
    isOther: Bool = true,
    createdAtMs: Int = 1_000_000,
    expiresAtMs: Int = 4_000_000_000_000,
    status: QuestionStatus = .pending) -> QuestionRecord
{
    QuestionRecord(
        id: "ask_123",
        questions: [
            Question(
                id: "meal",
                header: "Meal",
                question: "Choose dinner",
                options: [
                    QuestionOption(label: "Pizza", description: "Fast"),
                    QuestionOption(label: "Tacos"),
                ],
                multiselect: multiSelect,
                isother: isOther),
        ],
        agentid: "main",
        sessionkey: "agent:main:main",
        createdatms: createdAtMs,
        expiresatms: expiresAtMs,
        status: status)
}

@MainActor
@Test func `question card single select and other are exclusive`() {
    let model = LuckyNemoQuestionCardModel(record: questionRecord())
    model.toggleOption(questionID: "meal", label: "Pizza")
    #expect(model.beginSubmission() == ["meal": ["Pizza"]])
    model.failSubmission("retry")

    model.setOtherText(questionID: "meal", value: "  Salad  ")
    #expect(model.selectedOptions["meal"]?.isEmpty == true)
    #expect(model.beginSubmission() == ["meal": ["Salad"]])
}

@MainActor
@Test func `question card multi select uses declared option order`() {
    let model = LuckyNemoQuestionCardModel(record: questionRecord(multiSelect: true))
    model.toggleOption(questionID: "meal", label: "Tacos")
    model.toggleOption(questionID: "meal", label: "Pizza")
    #expect(model.beginSubmission() == ["meal": ["Pizza", "Tacos"]])
}

@MainActor
@Test func `question card maps expiry and answer origin`() {
    let now = Date(timeIntervalSince1970: 1500)
    let expired = LuckyNemoQuestionCardModel(record: questionRecord(expiresAtMs: 1_499_000))
    #expect(expired.status(at: now) == .expired)
    #expect(expired.remainingSeconds(at: now) == 0)

    let remote = LuckyNemoQuestionCardModel(record: questionRecord())
    remote.apply(resolved: LuckyNemoQuestionResolvedEvent(id: remote.id, status: .answered))
    #expect(remote.status(at: Date(timeIntervalSince1970: 1500)) == .answeredElsewhere)

    let local = LuckyNemoQuestionCardModel(record: questionRecord())
    local.markAnsweredLocally()
    local.apply(resolved: LuckyNemoQuestionResolvedEvent(id: local.id, status: .answered))
    #expect(local.status(at: Date(timeIntervalSince1970: 1500)) == .answered)
}

@MainActor
@Test func `question card pending refresh preserves submission`() {
    let model = LuckyNemoQuestionCardModel(record: questionRecord(expiresAtMs: Int.max))
    model.toggleOption(questionID: "meal", label: "Pizza")
    #expect(model.beginSubmission() != nil)

    #expect(model.apply(record: questionRecord(createdAtMs: 2_000_000, expiresAtMs: Int.max)))
    #expect(model.status(at: Date(timeIntervalSince1970: 1500)) == .submitting)

    #expect(model.apply(record: questionRecord(createdAtMs: 2_000_000, expiresAtMs: Int.max, status: .answered)))
    #expect(model.status(at: Date(timeIntervalSince1970: 1500)) == .answeredElsewhere)
}

@MainActor
@Test func `question card retains terminal feedback for gateway grace`() {
    let observedAt = Date(timeIntervalSince1970: 1500)
    let model = LuckyNemoQuestionCardModel(record: questionRecord())
    model.apply(resolved: .init(id: model.id, status: .answered), at: observedAt)

    #expect(model.shouldRetainAfterList(at: observedAt.addingTimeInterval(14)))
    #expect(!model.shouldRetainAfterList(at: observedAt.addingTimeInterval(15)))
}

@MainActor
@Test func `question card locally expired state enters terminal retention`() {
    let expiresAt = Date(timeIntervalSince1970: 1500)
    let model = LuckyNemoQuestionCardModel(record: questionRecord(expiresAtMs: 1_500_000))

    #expect(model.observeLocalExpiry(at: expiresAt))
    #expect(model.shouldRetainAfterList(at: expiresAt.addingTimeInterval(14)))
    #expect(!model.shouldRetainAfterList(at: expiresAt.addingTimeInterval(15)))
}

@MainActor
@Test func `question card stores local answers in gateway record shape`() throws {
    let model = LuckyNemoQuestionCardModel(record: questionRecord())
    model.toggleOption(questionID: "meal", label: "Pizza")
    model.markAnsweredLocally()

    let data = try JSONEncoder().encode(model.record.answers)
    let json = try #require(String(data: data, encoding: .utf8))
    #expect(json.contains("\"meal\":{\"answers\":[\"Pizza\"]}"))
}
