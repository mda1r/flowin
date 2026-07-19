using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.UpdateBranch;

public sealed record UpdateBranchCommand(
    Guid BranchId,
    Guid TenantId,
    string Name,
    BranchType Type,
    string? PhoneNumber,
    string? Email,
    string? Street,
    string? City,
    string? State,
    string? Country,
    string? PostalCode) : ICommand<BranchResponse>;
