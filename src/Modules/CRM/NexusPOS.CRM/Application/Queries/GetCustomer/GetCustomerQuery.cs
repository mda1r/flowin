using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.GetCustomer;

public sealed record GetCustomerQuery(Guid CustomerId, Guid TenantId) : IQuery<CustomerResponse>;
