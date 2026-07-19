using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.DeactivateBranch;

public sealed record DeactivateBranchCommand(Guid BranchId, Guid TenantId) : ICommand;
