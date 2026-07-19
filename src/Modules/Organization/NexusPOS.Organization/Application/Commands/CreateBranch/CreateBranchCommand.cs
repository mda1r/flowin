using NexusPOS.Organization.Application.Common;
using NexusPOS.Organization.Domain.Enums;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.CreateBranch;

public sealed record CreateBranchCommand(
    Guid TenantId,
    string Name,
    BranchType Type,
    bool IsMainBranch = false,
    string? PhoneNumber = null,
    string? Email = null,
    string? Street = null,
    string? City = null,
    string? State = null,
    string? Country = null,
    string? PostalCode = null) : ICommand<BranchResponse>;
