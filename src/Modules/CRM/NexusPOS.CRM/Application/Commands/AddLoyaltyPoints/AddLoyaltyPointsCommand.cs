using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Commands.AddLoyaltyPoints;

// A manual change by a manager; the reason and who made it are kept in the points ledger.
public sealed record AddLoyaltyPointsCommand(
    Guid CustomerId, Guid TenantId, int Points, string Reason, Guid? UserId = null) : ICommand<CustomerResponse>;
