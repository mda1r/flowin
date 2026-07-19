using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Queries.ListSubscriptionPlans;

public sealed record ListSubscriptionPlansQuery : IQuery<List<SubscriptionPlanResponse>>;
