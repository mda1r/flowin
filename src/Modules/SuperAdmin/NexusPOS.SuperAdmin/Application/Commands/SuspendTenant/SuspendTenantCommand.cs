using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.SuspendTenant;

public sealed record SuspendTenantCommand(Guid TenantId, string Reason) : ICommand;
