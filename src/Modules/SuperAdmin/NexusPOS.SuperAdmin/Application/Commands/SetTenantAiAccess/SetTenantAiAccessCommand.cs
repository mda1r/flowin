using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.SetTenantAiAccess;

public sealed record SetTenantAiAccessCommand(Guid TenantId, bool Enabled) : ICommand;
