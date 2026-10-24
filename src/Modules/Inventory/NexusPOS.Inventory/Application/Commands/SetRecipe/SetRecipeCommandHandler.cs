using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Inventory.Application.Common;
using NexusPOS.Inventory.Application.Queries.GetRecipe;
using NexusPOS.Inventory.Domain.Entities;
using NexusPOS.Inventory.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.SetRecipe;

internal sealed class SetRecipeCommandHandler(InventoryDbContext db)
    : ICommandHandler<SetRecipeCommand, RecipeResponse>
{
    public async Task<ErrorOr<RecipeResponse>> Handle(SetRecipeCommand request, CancellationToken cancellationToken)
    {
        List<Guid> materialIds = request.Lines.Select(l => l.MaterialId).ToList();
        int found = await db.StockMaterials
            .CountAsync(m => materialIds.Contains(m.Id) && m.TenantId == request.TenantId, cancellationToken);
        if (found != materialIds.Count)
        {
            return Error.Validation("Inventory.RecipeMaterialNotFound", "One or more materials were not found.");
        }

        List<RecipeLine> existing = await db.RecipeLines
            .Where(r => r.TenantId == request.TenantId && r.VariantId == request.VariantId)
            .ToListAsync(cancellationToken);
        db.RecipeLines.RemoveRange(existing);
        db.RecipeLines.AddRange(request.Lines.Select(l =>
            RecipeLine.Create(request.TenantId, request.VariantId, l.MaterialId, l.Quantity)));

        await db.SaveChangesAsync(cancellationToken);

        return await GetRecipeQueryHandler.Load(db, request.TenantId, request.VariantId, cancellationToken);
    }
}
