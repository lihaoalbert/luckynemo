import Foundation
import LuckyNemoProtocol

enum GatewayConnectPayload {
    static func makeClient(
        options: GatewayConnectOptions,
        displayName: String,
        platform: String) -> [String: LuckyNemoProtocol.AnyCodable]
    {
        var client: [String: LuckyNemoProtocol.AnyCodable] = [
            "id": LuckyNemoProtocol.AnyCodable(options.clientId),
            "displayName": LuckyNemoProtocol.AnyCodable(displayName),
            "version": LuckyNemoProtocol.AnyCodable(
                Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "dev"),
            "platform": LuckyNemoProtocol.AnyCodable(platform),
            "mode": LuckyNemoProtocol.AnyCodable(options.clientMode),
            "instanceId": LuckyNemoProtocol.AnyCodable(InstanceIdentity.instanceId),
            "deviceFamily": LuckyNemoProtocol.AnyCodable(InstanceIdentity.deviceFamily),
        ]
        if let model = InstanceIdentity.modelIdentifier {
            client["modelIdentifier"] = LuckyNemoProtocol.AnyCodable(model)
        }
        return client
    }
}
