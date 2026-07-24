import Foundation
import Testing
@testable import LuckyNemoKit

struct HealthCommandsTests {
    @Test func `health summary periods use the node command wire values`() throws {
        #expect(LuckyNemoHealthCommand.summary.rawValue == "health.summary")
        #expect(LuckyNemoHealthSummaryPeriod.allCases.map(\.rawValue) == ["today"])

        let params = LuckyNemoHealthSummaryParams(period: .today)
        let data = try JSONEncoder().encode(params)
        #expect(String(decoding: data, as: UTF8.self) == #"{"period":"today"}"#)
    }
}
