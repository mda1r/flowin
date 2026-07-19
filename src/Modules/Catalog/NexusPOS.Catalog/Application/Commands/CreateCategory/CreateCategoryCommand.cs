using NexusPOS.Catalog.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Catalog.Application.Commands.CreateCategory;

public sealed record CreateCategoryCommand(
    string Name,
    string? Description = null,
    Guid? ParentId = null,
    int SortOrder = 0) : ICommand<CategoryResponse>;
