import Testing
@testable import LuckyNemo

@Suite(.serialized)
@MainActor
struct OnboardingCoverageTests {
    @Test func `exercise onboarding pages`() {
        OnboardingView.exerciseForTesting()
    }
}
