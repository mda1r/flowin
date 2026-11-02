namespace NexusPOS.Catalog.Presentation.Requests;

// A null English name keeps the stored one; an empty one clears it.
public sealed record UpdateCategoryRequest(string Name, string? NameEn = null);
