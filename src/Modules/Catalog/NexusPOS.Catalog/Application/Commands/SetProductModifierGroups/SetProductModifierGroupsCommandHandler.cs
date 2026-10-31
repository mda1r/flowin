using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.SetProductModifierGroups;

internal sealed class SetProductModifierGroupsCommandHandler(CatalogDbContext db, ITenantContext tenantContext)
    : ICommandHandler<SetProductModifierGroupsCommand, Success>
{
    public async Task<ErrorOr<Success>> Handle(SetProductModifierGroupsCommand request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return CatalogErrors.NoTenant;
        }

        ProductId productId = new(request.ProductId);
        if (!await db.Products.AnyAsync(p => p.Id == productId, cancellationToken))
        {
            return CatalogErrors.ProductNotFound;
        }

        List<ModifierGroupId> wanted = [.. (request.GroupIds ?? []).Distinct().Select(id => new ModifierGroupId(id))];
        if (wanted.Count > 0)
        {
            Dictionary<ModifierGroupId, bool> found = await db.ModifierGroups
                .AsNoTracking()
                .Where(g => g.TenantId == tenantId && wanted.Contains(g.Id))
                .ToDictionaryAsync(g => g.Id, g => g.IsActive, cancellationToken);
            if (found.Count != wanted.Count)
            {
                return CatalogErrors.ModifierGroupNotFound;
            }

            if (found.ContainsValue(false))
            {
                return CatalogErrors.ModifierGroupInactive;
            }
        }

        List<ProductModifierGroup> current = await db.ProductModifierGroups
            .Where(l => l.ProductId == productId)
            .ToListAsync(cancellationToken);
        // One save: links still wanted are re-ordered in place (re-adding the same key would clash), the rest go.
        db.ProductModifierGroups.RemoveRange(current.Where(l => !wanted.Contains(l.GroupId)));
        for (int i = 0; i < wanted.Count; i++)
        {
            ProductModifierGroup? link = current.FirstOrDefault(l => l.GroupId == wanted[i]);
            if (link is null)
            {
                db.ProductModifierGroups.Add(ProductModifierGroup.Create(productId, wanted[i], i));
            }
            else
            {
                link.MoveTo(i);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
