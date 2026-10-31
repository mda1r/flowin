using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CancelRentalContract;

internal sealed class CancelRentalContractCommandHandler(
    IRentalContractRepository repository,
    HotelDbContext dbContext)
    : ICommandHandler<CancelRentalContractCommand, RentalContractResponse>
{
    public async Task<ErrorOr<RentalContractResponse>> Handle(
        CancelRentalContractCommand request,
        CancellationToken cancellationToken)
    {
        var contract = await repository.FindByIdAsync(
            new RentalContractId(request.ContractId), cancellationToken);

        if (contract is null || contract.BranchId != request.BranchId)
        {
            return HotelErrors.ContractNotFound;
        }

        ErrorOr<Success> result = contract.Cancel();
        if (result.IsError)
        {
            return result.Errors;
        }

        repository.Update(contract);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RentalContractResponse.From(contract);
    }
}
