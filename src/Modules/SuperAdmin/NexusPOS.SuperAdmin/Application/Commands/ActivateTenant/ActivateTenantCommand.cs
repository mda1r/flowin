using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.ActivateTenant;

public sealed record ActivateTenantCommand(Guid TenantId) : ICommand;
