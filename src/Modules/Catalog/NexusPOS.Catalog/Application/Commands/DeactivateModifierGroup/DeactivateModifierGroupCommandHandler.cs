using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.DeactivateModifierGroup;

// The group drops off every drink at once; its rows stay so past orders still resolve their add-ons.
internal sealed class DeactivateModifierGroupCommandHandler(CatalogDbContext db, ITenantContext tenantContext)
    : ICommandHandler<DeactivateModifierGroupCommand, Success>
{
    public async Task<ErrorOr<Success>> Handle(DeactivateModifierGroupCommand request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return CatalogErrors.NoTenant;
        }

        ModifierGroupId id = new(request.GroupId);
        ModifierGroup? group = await db.ModifierGroups
            .FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId, cancellationToken);
        if (group is null)
        {
            return CatalogErrors.ModifierGroupNotFound;
        }

        group.Deactivate();
        await db.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }
}
