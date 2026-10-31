using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Commands.AddLoyaltyPoints;

public sealed record AddLoyaltyPointsCommand(Guid CustomerId, Guid TenantId, int Points) : ICommand<CustomerResponse>;
