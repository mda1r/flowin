using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Catalog.Application.Common;
using NexusPOS.Catalog.Domain;
using NexusPOS.Catalog.Domain.Entities;
using NexusPOS.Catalog.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Catalog.Application.Commands.CreateModifierGroup;

internal sealed class CreateModifierGroupCommandHandler(CatalogDbContext db, ITenantContext tenantContext)
    : ICommandHandler<CreateModifierGroupCommand, ModifierGroupResponse>
{
    public async Task<ErrorOr<ModifierGroupResponse>> Handle(
        CreateModifierGroupCommand request, CancellationToken cancellationToken)
    {
        if (tenantContext.TenantId is not Guid tenantId)
        {
            return CatalogErrors.NoTenant;
        }

        string name = request.Name.Trim();
        if (await db.ModifierGroups.AnyAsync(g => g.TenantId == tenantId && g.IsActive && g.Name == name, cancellationToken))
        {
            return CatalogErrors.ModifierGroupNameExists;
        }

        ErrorOr<ModifierGroup> group = ModifierGroup.Create(
            tenantId, name, request.IsRequired, request.MinSelect, request.MaxSelect, request.SortOrder, request.Options ?? [], request.NameEn);
        if (group.IsError)
        {
            return group.Errors;
        }

        db.ModifierGroups.Add(group.Value);
        await db.SaveChangesAsync(cancellationToken);

        return ModifierMapper.ToResponse(group.Value, []);
    }
}
