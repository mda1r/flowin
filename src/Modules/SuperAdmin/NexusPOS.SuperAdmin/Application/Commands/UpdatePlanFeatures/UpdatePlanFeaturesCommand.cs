using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.UpdatePlanFeatures;

public sealed record UpdatePlanFeaturesCommand(
    Guid PlanId,
    IReadOnlyList<string> Features) : ICommand<SubscriptionPlanResponse>;
