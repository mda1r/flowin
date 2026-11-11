using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.SetTenantVat;

public sealed record SetTenantVatCommand(Guid TenantId, bool Enabled) : ICommand<TenantVatResponse>;

public sealed record TenantVatResponse(bool VatEnabled);
