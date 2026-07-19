using NexusPOS.Organization.Domain.Enums;

namespace NexusPOS.Organization.Presentation.Requests;

public sealed record UpdateBranchRequest(
    string Name,
    BranchType Type,
    string? PhoneNumber,
    string? Email,
    string? Street,
    string? City,
    string? State,
    string? Country,
    string? PostalCode);
