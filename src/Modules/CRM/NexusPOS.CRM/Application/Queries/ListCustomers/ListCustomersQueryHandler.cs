using ErrorOr;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.ListCustomers;

internal sealed class ListCustomersQueryHandler(ICustomerRepository customerRepository)
    : IQueryHandler<ListCustomersQuery, IReadOnlyList<CustomerResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<CustomerResponse>>> Handle(
        ListCustomersQuery request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<Domain.Entities.Customer> customers = await customerRepository.FindByTenantAsync(
            request.TenantId, request.Search, request.Page, request.PageSize, cancellationToken);

        return customers.Select(CrmMapper.ToResponse).ToList();
    }
}
