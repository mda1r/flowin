using NexusPOS.Organization.Domain.Enums;

namespace NexusPOS.Organization.Presentation.Requests;

public sealed record CreateBranchRequest(
    string Name,
    BranchType Type,
    bool IsMainBranch = false,
    string? PhoneNumber = null,
    string? Email = null,
    string? Street = null,
    string? City = null,
    string? State = null,
    string? Country = null,
    string? PostalCode = null);
