using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Queries.GetAllowedPages;

/// <summary>The signed-in user's page list, read fresh so an owner's change applies on the next page load.</summary>
public sealed record GetAllowedPagesQuery(Guid UserId, Guid TenantId) : IQuery<List<string>?>;
