using NexusPOS.POS.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.POS.Application.Commands.RedeemOrderLoyaltyPoints;

public sealed record RedeemOrderLoyaltyPointsCommand(Guid OrderId, Guid BranchId, int Points) : ICommand<OrderResponse>;
