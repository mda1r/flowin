namespace NexusPOS.SharedKernel.Application.Services;

/// <summary>
/// Feature keys a subscription plan can grant. The admin console (frontend/src/lib/planFeatures.ts)
/// offers the same keys, so keep both lists in sync.
/// </summary>
public static class PlanFeatures
{
    /// <summary>Sales assistant, sales insights and the tax advisor.</summary>
    public const string Ai = "ai";

    /// <summary>Voice/chat AI cashier for cafes.</summary>
    public const string AiCashier = "ai_cashier";

    /// <summary>Older plans saved the AI assistant under this key; it grants <see cref="Ai"/>.</summary>
    public const string LegacyAiAssistant = "ai_assistant";

    /// <summary>Lower-cases keys, maps legacy keys onto their current names and removes duplicates.</summary>
    public static IReadOnlyList<string> Normalize(IEnumerable<string> features) =>
        [.. features
            .Select(f => f.Trim().ToLowerInvariant())
            .Where(f => f.Length > 0)
            .Select(f => f == LegacyAiAssistant ? Ai : f)
            .Distinct()];
}
