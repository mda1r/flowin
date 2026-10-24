using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Commands.SetRecipe;

public sealed record SetRecipeCommand(Guid TenantId, Guid VariantId, IReadOnlyList<SetRecipeCommand.Line> Lines)
    : ICommand<RecipeResponse>
{
    public sealed record Line(Guid MaterialId, decimal Quantity);
}
