using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Domain.ValueObjects;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.UpdateModifierGroup;

internal sealed class UpdateModifierGroupCommandHandler(CatalogDbContext db, ITenantContext tenantContext)
    : ICommandHandler<UpdateModifierGroupCommand, ModifierGroupResponse>
{
    public async Task<ErrorOr<ModifierGroupResponse>> Handle(
        UpdateModifierGroupCommand request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return CatalogErrors.NoTenant;
        }

        ModifierGroupId id = new(request.GroupId);
        ModifierGroup? group = await db.ModifierGroups
            .Include(g => g.Options)
            .FirstOrDefaultAsync(g => g.Id == id && g.TenantId == tenantId, cancellationToken);
        if (group is null || !group.IsActive)
        {
            return CatalogErrors.ModifierGroupNotFound;
        }

        string name = request.Name.Trim();
        if (await db.ModifierGroups.AnyAsync(
                g => g.TenantId == tenantId && g.IsActive && g.Name == name && g.Id != id, cancellationToken))
        {
            return CatalogErrors.ModifierGroupNameExists;
        }

        ErrorOr<Success> updated = group.Update(
            name, request.IsRequired, request.MinSelect, request.MaxSelect, request.SortOrder, request.Options ?? [], request.NameEn);
        if (updated.IsError)
        {
            return updated.Errors;
        }

        await db.SaveChangesAsync(cancellationToken);

        List<Guid> productIds = await db.ProductModifierGroups
            .AsNoTracking()
            .Where(l => l.GroupId == id)
            .Select(l => l.ProductId.Value)
            .ToListAsync(cancellationToken);
        return ModifierMapper.ToResponse(group, productIds);
    }
}
