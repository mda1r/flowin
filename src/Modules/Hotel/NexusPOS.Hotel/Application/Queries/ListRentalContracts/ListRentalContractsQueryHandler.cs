using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.ListRentalContracts;

internal sealed class ListRentalContractsQueryHandler(IRentalContractRepository repository)
    : IQueryHandler<ListRentalContractsQuery, IReadOnlyList<RentalContractResponse>>
{
    public async Task<ErrorOr<IReadOnlyList<RentalContractResponse>>> Handle(
        ListRentalContractsQuery request,
        CancellationToken cancellationToken)
    {
        var contracts = await repository.ListByBranchAsync(
            request.BranchId, request.Page, request.PageSize, cancellationToken);

        return contracts.Select(RentalContractResponse.From).ToList();
    }
}
