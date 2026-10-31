using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Queries.GetRentalContract;

internal sealed class GetRentalContractQueryHandler(IRentalContractRepository repository)
    : IQueryHandler<GetRentalContractQuery, RentalContractResponse>
{
    public async Task<ErrorOr<RentalContractResponse>> Handle(
        GetRentalContractQuery request,
        CancellationToken cancellationToken)
    {
        var contract = await repository.FindByIdAsync(
            new RentalContractId(request.ContractId), cancellationToken);

        if (contract is null)
        {
            return HotelErrors.ContractNotFound;
        }

        return RentalContractResponse.From(contract);
    }
}
