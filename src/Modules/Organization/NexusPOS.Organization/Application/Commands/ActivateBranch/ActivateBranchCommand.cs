using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.ActivateBranch;

public sealed record ActivateBranchCommand(Guid BranchId, Guid TenantId) : ICommand;
