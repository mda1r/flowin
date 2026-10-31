using ErrorOr;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.CountCustomers;

internal sealed class CountCustomersQueryHandler(ICustomerRepository customerRepository)
    : IQueryHandler<CountCustomersQuery, int>
{
    public async Task<ErrorOr<int>> Handle(CountCustomersQuery request, CancellationToken cancellationToken) =>
        await customerRepository.CountByTenantAsync(request.TenantId, request.Search, cancellationToken);
}
