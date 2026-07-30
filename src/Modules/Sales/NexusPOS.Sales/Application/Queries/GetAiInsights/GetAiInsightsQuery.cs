using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Sales.Application.Queries.GetAiInsights;

public sealed record GetAiInsightsQuery(Guid BranchId) : IQuery<AiInsightsResponse>;

public sealed record AiInsightsResponse(
    string SalesInsight,
    string TrendInsight,
    string Recommendation,
    DateTime GeneratedAt);
