using NexusPOS.Organization.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Organization.Application.Commands.CreateTenant;

public sealed record CreateTenantCommand(
    string Name,
    string Subdomain,
    string AdminEmail,
    string Currency = "USD",
    string TimeZone = "UTC") : ICommand<TenantResponse>;
