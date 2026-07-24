import Foundation
import LuckyNemoChatUI

extension MacGatewayChatTransport {
    func acquireSessionMutationRouteLease() async -> LuckyNemoChatSessionMutationRouteLease? {
        guard let serverLease = await GatewayConnection.shared.captureServerLease() else { return nil }
        if let outboxGatewayID {
            let currentGatewayID = await MainActor.run { MacChatTranscriptCache.currentGatewayID() }
            guard currentGatewayID == outboxGatewayID else { return nil }
        }
        let transport = self
        return LuckyNemoChatSessionMutationRouteLease { key, label, category, pinned, archived, unread in
            let target = transport.sessionTarget(for: key)
            let request = LuckyNemoChatGatewayRequests.patchSession(
                sessionKey: target.sessionKey,
                agentID: target.agentID,
                label: label,
                category: category,
                pinned: pinned,
                archived: archived,
                unread: unread)
            _ = try await GatewayConnection.shared.request(
                method: request.method,
                params: request.params,
                timeoutMs: request.timeoutMs,
                ifCurrentServerLease: serverLease)
        }
    }

    func forkSession(parentKey: String) async throws -> String {
        guard let serverLease = await GatewayConnection.shared.captureServerLease() else {
            throw LuckyNemoChatTransportSendError.notDispatched
        }
        if let outboxGatewayID {
            let currentGatewayID = await MainActor.run { MacChatTranscriptCache.currentGatewayID() }
            guard currentGatewayID == outboxGatewayID else {
                throw LuckyNemoChatTransportSendError.notDispatched
            }
        }
        let target = self.sessionTarget(for: parentKey)
        let request = LuckyNemoChatGatewayRequests.forkSession(
            parentSessionKey: target.sessionKey,
            agentID: target.agentID)
        let data = try await GatewayConnection.shared.request(
            method: request.method,
            params: request.params,
            timeoutMs: request.timeoutMs,
            ifCurrentServerLease: serverLease)
        return try JSONDecoder().decode(LuckyNemoChatCreateSessionResponse.self, from: data).key
    }
}
