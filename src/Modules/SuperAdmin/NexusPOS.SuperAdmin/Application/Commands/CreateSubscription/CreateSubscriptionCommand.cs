using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateSubscription;

public sealed record CreateSubscriptionCommand(
    Guid TenantId,
    Guid PlanId,
    DateTime StartDate,
    DateTime ExpiryDate,
    string? Notes) : ICommand<TenantSubscriptionResponse>;
