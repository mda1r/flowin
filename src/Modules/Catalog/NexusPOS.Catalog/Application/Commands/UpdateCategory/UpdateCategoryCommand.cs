using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.UpdateCategory;

// Renames a category; a null English name keeps the stored one, an empty one clears it.
public sealed record UpdateCategoryCommand(Guid CategoryId, string Name, string? NameEn = null) : ICommand<CategoryResponse>;
