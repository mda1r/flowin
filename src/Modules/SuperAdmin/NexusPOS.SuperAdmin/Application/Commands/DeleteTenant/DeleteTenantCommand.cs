using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.DeleteTenant;

public sealed record DeleteTenantCommand(Guid TenantId) : ICommand;
