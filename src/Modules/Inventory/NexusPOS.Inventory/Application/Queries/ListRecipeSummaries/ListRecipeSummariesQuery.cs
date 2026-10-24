using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.ListRecipeSummaries;

public sealed record ListRecipeSummariesQuery(Guid TenantId) : IQuery<IReadOnlyList<RecipeSummaryResponse>>;
