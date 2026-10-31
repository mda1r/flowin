using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.RenewSubscription;

/// <summary>
/// Extends the end of the tenant's subscription chain by a number of months on the same plan.
/// <paramref name="SubscriptionId"/>, when given, must still be that end of chain.
/// </summary>
public sealed record RenewSubscriptionCommand(Guid TenantId, int Months, Guid? SubscriptionId = null) : ICommand<TenantSubscriptionResponse>;
