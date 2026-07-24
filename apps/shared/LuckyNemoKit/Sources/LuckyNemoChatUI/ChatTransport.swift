import Foundation
import LuckyNemoProtocol

public enum LuckyNemoChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case sessionsChanged(LuckyNemoChatSessionsChangedEvent)
    case chat(LuckyNemoChatEventPayload)
    case sessionMessage(LuckyNemoSessionMessageEventPayload)
    case agent(LuckyNemoAgentEventPayload)
    case questionRequested(QuestionRecord)
    case questionResolved(LuckyNemoQuestionResolvedEvent)
    case seqGap
}

public struct LuckyNemoQuestionResolvedEvent: Codable, Sendable {
    public let id: String
    public let status: QuestionStatus
    public let answers: QuestionAnswers?

    // periphery:ignore - Package consumers construct transport events; native apps decode them.
    public init(id: String, status: QuestionStatus, answers: QuestionAnswers? = nil) {
        self.id = id
        self.status = status
        self.answers = answers
    }
}

public struct LuckyNemoChatSessionsChangedEvent: Codable, Sendable, Equatable {
    public let sessionKey: String?
    public let agentId: String?
    public let reason: String

    public init(sessionKey: String?, agentId: String? = nil, reason: String) {
        self.sessionKey = sessionKey
        self.agentId = agentId
        self.reason = reason
    }
}

/// One immutable transport route used by an entire outbox flush. Route-aware
/// transports bind both sends and confirmation reads to the same connection;
/// a gateway switch then cancels the old work instead of retargeting it.
public struct LuckyNemoChatTransportRouteLease: Sendable {
    public typealias SendMessage = @Sendable (
        _ sessionKey: String,
        _ message: String,
        _ thinking: String,
        _ idempotencyKey: String,
        _ attachments: [LuckyNemoChatAttachmentPayload]) async throws -> LuckyNemoChatSendResponse
    public typealias RequestHistory = @Sendable (String) async throws -> LuckyNemoChatHistoryPayload
    public typealias SendTargetedMessage = @Sendable (
        _ sessionKey: String,
        _ agentID: String?,
        _ message: String,
        _ thinking: String,
        _ idempotencyKey: String,
        _ attachments: [LuckyNemoChatAttachmentPayload]) async throws -> LuckyNemoChatSendResponse
    public typealias RequestTargetedHistory = @Sendable (
        _ sessionKey: String,
        _ agentID: String?) async throws -> LuckyNemoChatHistoryPayload

    private let sendTargetedMessageImpl: SendTargetedMessage
    private let requestTargetedHistoryImpl: RequestTargetedHistory
    public let sessionRoutingContract: String?

    public init(
        sendMessage: @escaping SendMessage,
        requestHistory: @escaping RequestHistory,
        sessionRoutingContract: String? = nil)
    {
        self.sessionRoutingContract = sessionRoutingContract
        self.sendTargetedMessageImpl = { sessionKey, _, message, thinking, idempotencyKey, attachments in
            try await sendMessage(sessionKey, message, thinking, idempotencyKey, attachments)
        }
        self.requestTargetedHistoryImpl = { sessionKey, _ in
            try await requestHistory(sessionKey)
        }
    }

    public init(
        sendTargetedMessage: @escaping SendTargetedMessage,
        requestTargetedHistory: @escaping RequestTargetedHistory,
        sessionRoutingContract: String? = nil)
    {
        self.sessionRoutingContract = sessionRoutingContract
        self.sendTargetedMessageImpl = sendTargetedMessage
        self.requestTargetedHistoryImpl = requestTargetedHistory
    }

    public func sendMessage(
        sessionKey: String,
        agentID: String? = nil,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [LuckyNemoChatAttachmentPayload]) async throws -> LuckyNemoChatSendResponse
    {
        try await self.sendTargetedMessageImpl(
            sessionKey,
            agentID,
            message,
            thinking,
            idempotencyKey,
            attachments)
    }

    public func requestHistory(
        sessionKey: String,
        agentID: String? = nil) async throws -> LuckyNemoChatHistoryPayload
    {
        try await self.requestTargetedHistoryImpl(sessionKey, agentID)
    }
}

public enum LuckyNemoChatTransportRouteLeaseResult: Sendable {
    case available(LuckyNemoChatTransportRouteLease)
    case unavailable(reason: String?)
}

/// One physical gateway connection captured before a settings mutation waits
/// behind earlier mutations for the same session.
public struct LuckyNemoChatSessionSettingsRouteLease: Sendable {
    public typealias PatchSessionSettings = @Sendable (
        _ sessionKey: String,
        _ agentID: String?,
        _ patch: LuckyNemoChatSessionSettingsPatch) async throws -> LuckyNemoChatModelPatchResult?

    private let patchSessionSettingsImpl: PatchSessionSettings

    public init(patchSessionSettings: @escaping PatchSessionSettings) {
        self.patchSessionSettingsImpl = patchSessionSettings
    }

    public func patchSessionSettings(
        sessionKey: String,
        agentID: String?,
        patch: LuckyNemoChatSessionSettingsPatch) async throws -> LuckyNemoChatModelPatchResult?
    {
        try await self.patchSessionSettingsImpl(sessionKey, agentID, patch)
    }
}

/// One physical gateway connection captured before a session mutation waits
/// behind an earlier mutation for the same session.
public struct LuckyNemoChatSessionMutationRouteLease: Sendable {
    public typealias PatchSession = @Sendable (
        _ key: String,
        _ label: String??,
        _ category: String??,
        _ pinned: Bool?,
        _ archived: Bool?,
        _ unread: Bool?) async throws -> Void

    private let patchSessionImpl: PatchSession

    public init(patchSession: @escaping PatchSession) {
        self.patchSessionImpl = patchSession
    }

    public func patchSession(
        key: String,
        label: String??,
        category: String??,
        pinned: Bool?,
        archived: Bool?,
        unread: Bool?) async throws
    {
        try await self.patchSessionImpl(key, label, category, pinned, archived, unread)
    }
}

/// The transport rejected a send before it reached its request channel. This
/// is the only failure class safe for automatic outbox retry.
public enum LuckyNemoChatTransportSendError: Error, Sendable {
    case notDispatched
}

public enum LuckyNemoChatTransportUpgradeMessage {
    public static let routingContract =
        "Update the gateway before sending queued messages. This version requires safe delivery routing."
}

public enum LuckyNemoChatRunTerminalState: Sendable, Equatable {
    case completed
    case failed(message: String)
}

public enum LuckyNemoChatRunObservation: Sendable, Equatable {
    case terminal(LuckyNemoChatRunTerminalState)
    case checkAgain
    case unavailable

    public static func fromWaitResponse(
        status: String?,
        endedAt: Double? = nil,
        error: String? = nil,
        stopReason: String? = nil,
        livenessState: String? = nil,
        yielded: Bool? = nil,
        pendingError: Bool? = nil,
        timeoutPhase: String? = nil,
        providerStarted: Bool? = nil,
        aborted: Bool? = nil) -> Self
    {
        let status = Self.normalized(status)
        if status == "pending" {
            return .checkAgain
        }
        if ["ok", "completed", "success", "succeeded"].contains(status) {
            return .terminal(.completed)
        }
        if [
            "error", "failed", "aborted", "cancelled", "canceled", "killed", "timed_out",
        ].contains(status) {
            return .terminal(.failed(message: Self.failureMessage(
                status: status,
                error: error,
                stopReason: stopReason,
                aborted: aborted)))
        }
        guard status == "timeout" else { return .unavailable }
        guard pendingError != true else { return .checkAgain }

        let timeoutPhase = Self.normalized(timeoutPhase)
        let stopReason = Self.normalized(stopReason)
        let terminalTimeout = ["preflight", "provider", "post_turn"].contains(timeoutPhase) ||
            ["timeout", "timed_out"].contains(stopReason) ||
            endedAt != nil ||
            !Self.normalized(error).isEmpty ||
            !stopReason.isEmpty ||
            !Self.normalized(livenessState).isEmpty ||
            yielded == true ||
            aborted == true ||
            (providerStarted == true && timeoutPhase != "queue" && timeoutPhase != "gateway_draining")
        return terminalTimeout
            ? .terminal(.failed(message: Self.failureMessage(
                status: status,
                error: error,
                stopReason: stopReason,
                aborted: aborted)))
            : .checkAgain
    }

    private static func normalized(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func failureMessage(
        status: String,
        error: String?,
        stopReason: String?,
        aborted: Bool?) -> String
    {
        if let error = error?.trimmingCharacters(in: .whitespacesAndNewlines), !error.isEmpty {
            return error
        }
        let stopReason = Self.normalized(stopReason)
        if aborted == true || status == "aborted" || stopReason == "aborted" {
            return "Run aborted"
        }
        if ["cancelled", "canceled", "killed"].contains(status) ||
            ["cancelled", "canceled", "killed", "restart", "rpc", "stop", "user"].contains(stopReason)
        {
            return "Run cancelled"
        }
        if status == "timeout" || status == "timed_out" ||
            stopReason == "timeout" || stopReason == "timed_out"
        {
            return "Run timed out"
        }
        return "Chat failed"
    }
}

public protocol LuckyNemoChatTransport: Sendable {
    func createSession(
        key: String,
        label: String?,
        parentSessionKey: String?,
        worktree: Bool?) async throws -> LuckyNemoChatCreateSessionResponse

    func requestHistory(sessionKey: String) async throws -> LuckyNemoChatHistoryPayload
    func requestFullMessage(sessionKey: String, messageID: String) async throws -> LuckyNemoChatMessage?
    func listModels() async throws -> [LuckyNemoChatModelChoice]
    var supportsSlashCommandCatalog: Bool { get }
    func listCommands(sessionKey: String) async throws -> [LuckyNemoChatCommandChoice]
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [LuckyNemoChatAttachmentPayload]) async throws -> LuckyNemoChatSendResponse
    func sendMessage(
        sessionKey: String,
        agentID: String?,
        expectedSessionRoutingContract: String?,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [LuckyNemoChatAttachmentPayload]) async throws -> LuckyNemoChatSendResponse

    /// Captures the current route for a durable outbox flush. Implementations
    /// backed by a mutable gateway must override this with route-checked calls.
    func acquireOutboxRouteLease() async -> LuckyNemoChatTransportRouteLeaseResult
    var outboxRequiresSessionRoutingContract: Bool { get }

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(
        limit: Int?,
        search: String?,
        archived: Bool) async throws -> LuckyNemoChatSessionsListResponse
    func patchSession(
        key: String,
        label: String??,
        category: String??,
        pinned: Bool?,
        archived: Bool?,
        unread: Bool?) async throws
    func acquireSessionMutationRouteLease() async -> LuckyNemoChatSessionMutationRouteLease?
    func deleteSession(key: String) async throws
    func forkSession(parentKey: String) async throws -> String
    func setSessionModel(sessionKey: String, model: String?) async throws
    func patchSessionModel(
        sessionKey: String,
        agentID: String?,
        model: String?) async throws -> LuckyNemoChatModelPatchResult?
    func setSessionThinking(sessionKey: String, thinkingLevel: String) async throws
    func patchSessionSettings(
        sessionKey: String,
        agentID: String?,
        patch: LuckyNemoChatSessionSettingsPatch) async throws -> LuckyNemoChatModelPatchResult?
    /// Mutable gateway transports must capture the physical connection here;
    /// queued settings work must never resolve its route after waiting.
    func acquireSessionSettingsRouteLease() async -> LuckyNemoChatSessionSettingsRouteLease?

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func listQuestions() async throws -> [QuestionRecord]
    func resolveQuestion(id: String, answers: [String: [String]]) async throws
    func waitForRunCompletion(runId: String, timeoutMs: Int) async -> LuckyNemoChatRunObservation
    func events() -> AsyncStream<LuckyNemoChatTransportEvent>
    func resolveInlineWidgetResource(
        path: String,
        replacing failedResource: LuckyNemoChatWidgetResource?) async -> LuckyNemoChatWidgetResource?
    func resolveInlineWidgetURL(path: String, replacing failedURL: URL?) async -> URL?

    func setActiveSessionKey(_ sessionKey: String) async throws
    func resetSession(sessionKey: String) async throws
    func compactSession(sessionKey: String) async throws
}

extension LuckyNemoChatTransport {
    public func listQuestions() async throws -> [QuestionRecord] {
        []
    }

    public func resolveQuestion(id _: String, answers _: [String: [String]]) async throws {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "question.resolve not supported by this transport"])
    }

    public func requestFullMessage(sessionKey _: String, messageID _: String) async throws -> LuckyNemoChatMessage? {
        nil
    }

    public func resolveInlineWidgetResource(
        path: String,
        replacing failedResource: LuckyNemoChatWidgetResource?) async -> LuckyNemoChatWidgetResource?
    {
        guard let url = await resolveInlineWidgetURL(path: path, replacing: failedResource?.url) else { return nil }
        return LuckyNemoChatWidgetResource(url: url)
    }

    public func resolveInlineWidgetURL(path _: String, replacing _: URL?) async -> URL? {
        nil
    }

    public var outboxRequiresSessionRoutingContract: Bool {
        false
    }

    public func acquireOutboxRouteLease() async -> LuckyNemoChatTransportRouteLeaseResult {
        let transport = self
        return .available(LuckyNemoChatTransportRouteLease(
            sendMessage: { sessionKey, message, thinking, idempotencyKey, attachments in
                try await transport.sendMessage(
                    sessionKey: sessionKey,
                    message: message,
                    thinking: thinking,
                    idempotencyKey: idempotencyKey,
                    attachments: attachments)
            },
            requestHistory: { sessionKey in
                try await transport.requestHistory(sessionKey: sessionKey)
            }))
    }

    public func acquireSessionSettingsRouteLease() async -> LuckyNemoChatSessionSettingsRouteLease? {
        let transport = self
        return LuckyNemoChatSessionSettingsRouteLease { sessionKey, agentID, patch in
            try await transport.patchSessionSettings(
                sessionKey: sessionKey,
                agentID: agentID,
                patch: patch)
        }
    }

    public func acquireSessionMutationRouteLease() async -> LuckyNemoChatSessionMutationRouteLease? {
        let transport = self
        return LuckyNemoChatSessionMutationRouteLease { key, label, category, pinned, archived, unread in
            try await transport.patchSession(
                key: key,
                label: label,
                category: category,
                pinned: pinned,
                archived: archived,
                unread: unread)
        }
    }

    public func sendMessage(
        sessionKey: String,
        agentID _: String?,
        expectedSessionRoutingContract _: String?,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [LuckyNemoChatAttachmentPayload]) async throws -> LuckyNemoChatSendResponse
    {
        try await self.sendMessage(
            sessionKey: sessionKey,
            message: message,
            thinking: thinking,
            idempotencyKey: idempotencyKey,
            attachments: attachments)
    }

    public func createSession(
        key _: String,
        label _: String?,
        parentSessionKey _: String?,
        worktree _: Bool?) async throws -> LuckyNemoChatCreateSessionResponse
    {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.create not supported by this transport"])
    }

    public func setActiveSessionKey(_: String) async throws {}

    public func waitForRunCompletion(runId _: String, timeoutMs _: Int) async -> LuckyNemoChatRunObservation {
        .unavailable
    }

    public func resetSession(sessionKey _: String) async throws {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.reset not supported by this transport"])
    }

    public func compactSession(sessionKey _: String) async throws {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.compact not supported by this transport"])
    }

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(
        limit _: Int?,
        search _: String?,
        archived _: Bool) async throws -> LuckyNemoChatSessionsListResponse
    {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }

    /// Conveniences for callers that only page a list. Transports must
    /// implement the canonical `listSessions(limit:search:archived:)`
    /// requirement; same-name methods on a conformer are shadowed by these
    /// sugars and never called through the protocol.
    public func listSessions(limit: Int?) async throws -> LuckyNemoChatSessionsListResponse {
        try await self.listSessions(limit: limit, search: nil, archived: false)
    }

    public func listSessions(limit: Int?, archived: Bool) async throws -> LuckyNemoChatSessionsListResponse {
        try await self.listSessions(limit: limit, search: nil, archived: archived)
    }

    public func patchSession(
        key _: String,
        label _: String?? = nil,
        category _: String?? = nil,
        pinned _: Bool? = nil,
        archived _: Bool? = nil,
        unread _: Bool? = nil) async throws
    {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch not supported by this transport"])
    }

    public func deleteSession(key _: String) async throws {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.delete not supported by this transport"])
    }

    public func forkSession(parentKey _: String) async throws -> String {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.create fork not supported by this transport"])
    }

    public func listModels() async throws -> [LuckyNemoChatModelChoice] {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "models.list not supported by this transport"])
    }

    public var supportsSlashCommandCatalog: Bool {
        false
    }

    public func listCommands(sessionKey _: String) async throws -> [LuckyNemoChatCommandChoice] {
        []
    }

    public func setSessionModel(sessionKey _: String, model _: String?) async throws {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(model) not supported by this transport"])
    }

    public func patchSessionModel(
        sessionKey: String,
        agentID _: String?,
        model: String?) async throws -> LuckyNemoChatModelPatchResult?
    {
        try await self.setSessionModel(sessionKey: sessionKey, model: model)
        return nil
    }

    public func setSessionThinking(sessionKey _: String, thinkingLevel _: String) async throws {
        throw NSError(
            domain: "LuckyNemoChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(thinkingLevel) not supported by this transport"])
    }

    public func patchSessionSettings(
        sessionKey: String,
        agentID: String?,
        patch: LuckyNemoChatSessionSettingsPatch) async throws -> LuckyNemoChatModelPatchResult?
    {
        var result: LuckyNemoChatModelPatchResult?
        if let model = patch.model {
            result = try await self.patchSessionModel(
                sessionKey: sessionKey,
                agentID: agentID,
                model: model)
        }
        if let thinkingLevelUpdate = patch.thinkingLevel {
            guard let thinkingLevel = thinkingLevelUpdate else {
                throw NSError(
                    domain: "LuckyNemoChatTransport",
                    code: 0,
                    userInfo: [
                        NSLocalizedDescriptionKey: "sessions.patch(thinkingLevel=null) not supported by this transport",
                    ])
            }
            try await self.setSessionThinking(
                sessionKey: sessionKey,
                thinkingLevel: thinkingLevel)
            result = LuckyNemoChatModelPatchResult(
                key: result?.key ?? sessionKey,
                modelProvider: result?.modelProvider,
                model: result?.model,
                thinkingLevel: thinkingLevel,
                thinkingLevels: result?.thinkingLevels)
        }
        return result
    }
}

public enum LuckyNemoChatSessionRoutingContract {
    public static let changedErrorReason = "session-routing-changed"

    public struct Components: Equatable, Sendable {
        public let scope: String
        public let mainKey: String
        public let defaultAgentID: String
    }

    /// Live sends may proceed before routing identity is available. Queued
    /// replay acquires a separate route lease and never uses a nil contract.
    public static func expectedValue(
        _ contract: String?,
        serverSupportsGuard: Bool) -> String?
    {
        guard serverSupportsGuard else { return nil }
        return self.normalize(contract)
    }

    public static func make(
        scope: String?,
        mainKey: String?,
        defaultAgentID: String?) -> String?
    {
        let normalizedScope = self.normalize(scope)
        let normalizedMainKey = self.normalize(mainKey)
        let normalizedDefaultAgentID = self.normalize(defaultAgentID)
        guard let normalizedScope, let normalizedMainKey, let normalizedDefaultAgentID else { return nil }
        return "\(normalizedScope)|\(normalizedMainKey)|\(normalizedDefaultAgentID)"
    }

    /// Scope and agent ids cannot contain `|`; parse from both ends so an
    /// older custom main key containing the delimiter still round-trips.
    public static func parse(_ contract: String?) -> Components? {
        guard let normalized = self.normalize(contract),
              let firstSeparator = normalized.firstIndex(of: "|"),
              let lastSeparator = normalized.lastIndex(of: "|"),
              firstSeparator != lastSeparator
        else { return nil }
        let scope = String(normalized[..<firstSeparator])
        let mainKey = String(normalized[normalized.index(after: firstSeparator)..<lastSeparator])
        let defaultAgentID = String(normalized[normalized.index(after: lastSeparator)...])
        guard !scope.isEmpty, !mainKey.isEmpty, !defaultAgentID.isEmpty else { return nil }
        return Components(scope: scope, mainKey: mainKey, defaultAgentID: defaultAgentID)
    }

    private static func normalize(_ value: String?) -> String? {
        let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return normalized?.isEmpty == false ? normalized : nil
    }
}
