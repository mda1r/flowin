using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.ActivateRentalContract;

internal sealed class ActivateRentalContractCommandHandler(
    IRentalContractRepository repository,
    HotelDbContext dbContext)
    : ICommandHandler<ActivateRentalContractCommand, RentalContractResponse>
{
    public async Task<ErrorOr<RentalContractResponse>> Handle(
        ActivateRentalContractCommand request,
        CancellationToken cancellationToken)
    {
        var contract = await repository.FindByIdAsync(
            new RentalContractId(request.ContractId), cancellationToken);

        if (contract is null || contract.BranchId != request.BranchId)
        {
            return HotelErrors.ContractNotFound;
        }

        ErrorOr<Success> result = contract.Activate();
        if (result.IsError)
        {
            return result.Errors;
        }

        repository.Update(contract);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RentalContractResponse.From(contract);
    }
}
