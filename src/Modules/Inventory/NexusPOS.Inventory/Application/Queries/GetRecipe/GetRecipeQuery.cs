using NexusPOS.Inventory.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Inventory.Application.Queries.GetRecipe;

public sealed record GetRecipeQuery(Guid TenantId, Guid VariantId) : IQuery<RecipeResponse>;
