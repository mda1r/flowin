using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using Npgsql;

namespace NexusPOS.Catalog.Application.Queries.ListModifierGroups;

internal sealed class ListModifierGroupsQueryHandler(CatalogDbContext db, ITenantContext tenantContext)
    : IQueryHandler<ListModifierGroupsQuery, IReadOnlyList<ModifierGroupResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<ModifierGroupResponse>>> Handle(
        ListModifierGroupsQuery request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return CatalogErrors.NoTenant;
        }

        try
        {
            List<ModifierGroup> groups = await db.ModifierGroups
                .AsNoTracking()
                .Include(g => g.Options)
                .Where(g => g.TenantId == tenantId && (request.IncludeInactive || g.IsActive))
                .OrderBy(g => g.SortOrder)
                .ThenBy(g => g.Name)
                .ToListAsync(cancellationToken);

            List<ModifierGroupId> ids = [.. groups.Select(g => g.Id)];
            List<ProductModifierGroup> links = ids.Count == 0
                ? []
                : await db.ProductModifierGroups
                    .AsNoTracking()
                    .Where(l => ids.Contains(l.GroupId))
                    .ToListAsync(cancellationToken);
            ILookup<ModifierGroupId, Guid> productsByGroup = links.ToLookup(l => l.GroupId, l => l.ProductId.Value);

            return groups.Select(g => ModifierMapper.ToResponse(g, [.. productsByGroup[g.Id]])).ToList();
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UndefinedTable)
        {
            // Modifier tables not created yet for this tenant: nothing defined.
            return new List<ModifierGroupResponse>();
        }
    }
}
