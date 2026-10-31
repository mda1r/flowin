using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.SetMainBranch;

public sealed record SetMainBranchCommand(Guid BranchId, Guid TenantId) : ICommand;
