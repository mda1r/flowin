using NexusPOS.SuperAdmin.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.SuperAdmin.Application.Commands.CreateSubscriptionPlan;

public sealed record CreateSubscriptionPlanCommand(
    string Name,
    string? BusinessType,
    decimal Price,
    int MaxBranches,
    int MaxUsers,
    List<string> Features) : ICommand<SubscriptionPlanResponse>;
