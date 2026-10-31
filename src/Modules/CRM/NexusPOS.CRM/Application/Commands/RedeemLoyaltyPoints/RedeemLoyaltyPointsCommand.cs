using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Commands.RedeemLoyaltyPoints;

public sealed record RedeemLoyaltyPointsCommand(Guid CustomerId, Guid TenantId, int Points) : ICommand<CustomerResponse>;
