using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.RenewSubscription;

/// <summary>Extends the tenant's current subscription by a number of months on the same plan.</summary>
public sealed record RenewSubscriptionCommand(Guid TenantId, int Months) : ICommand<TenantSubscriptionResponse>;
