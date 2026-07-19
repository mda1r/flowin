using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateTenant;

public sealed record CreateTenantCommand(
    string Name,
    string Subdomain,
    string AdminEmail,
    string BusinessType,
    string Currency,
    string TimeZone) : ICommand<TenantWithSubscriptionResponse>;
