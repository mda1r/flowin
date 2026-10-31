using FluentAssertions;
using NexusPOS.SharedKernel.Application.Services;

namespace NexusPOS.SharedKernel.UnitTests.Application;

public sealed class PlanFeaturesTests
{
    [Fact]
    public void Normalize_LegacyAiAssistant_GrantsAi()
    {
        PlanFeatures.Normalize(["ai_assistant", "crm"]).Should().BeEquivalentTo(["ai", "crm"]);
    }

    [Fact]
    public void Normalize_RemovesDuplicatesAndBlanks()
    {
        PlanFeatures.Normalize(["ai", "ai_assistant", " ", "AI_CASHIER", "ai_cashier"])
            .Should().BeEquivalentTo(["ai", "ai_cashier"]);
    }
}
