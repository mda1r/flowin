using ErrorOr;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.GetCustomer;

internal sealed class GetCustomerQueryHandler(ICustomerRepository customerRepository)
    : IQueryHandler<GetCustomerQuery, CustomerResponse>
{
    public async Task<ErrorOr<CustomerResponse>> Handle(
        GetCustomerQuery request,
        CancellationToken cancellationToken)
    {
        Customer? customer = await customerRepository.FindByIdAsync(
            new CustomerId(request.CustomerId), cancellationToken);

        if (customer is null || customer.TenantId != request.TenantId)
        {
            return CrmErrors.CustomerNotFound;
        }

        return CrmMapper.ToResponse(customer);
    }
}
