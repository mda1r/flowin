using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Commands.UpdateCustomer;

public sealed record UpdateCustomerCommand(
    Guid CustomerId,
    Guid TenantId,
    string Name,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    DateOnly? DateOfBirth = null,
    string? Notes = null) : ICommand<CustomerResponse>;
