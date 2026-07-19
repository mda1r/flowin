using NexusPOS.Organization.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.UpdateTenantProfile;

public sealed record UpdateTenantProfileCommand(
    Guid TenantId,
    string Name,
    string Currency,
    string TimeZone,
    string? LogoUrl,
    string? PhoneNumber,
    string? TaxId) : ICommand<TenantResponse>;
