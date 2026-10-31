using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.UpdateRentalContract;

internal sealed class UpdateRentalContractCommandHandler(
    IRentalContractRepository repository,
    HotelDbContext dbContext)
    : ICommandHandler<UpdateRentalContractCommand, RentalContractResponse>
{
    public async Task<ErrorOr<RentalContractResponse>> Handle(
        UpdateRentalContractCommand request,
        CancellationToken cancellationToken)
    {
        var contract = await repository.FindByIdAsync(
            new RentalContractId(request.ContractId), cancellationToken);

        if (contract is null || contract.BranchId != request.BranchId)
        {
            return HotelErrors.ContractNotFound;
        }

        ErrorOr<Success> detailsResult = contract.UpdateDetails(
            request.TenantName,
            request.TenantNationalId,
            request.TenantPhone,
            request.RoomNumber,
            request.StartDate,
            request.EndDate,
            request.MonthlyRent,
            request.LandlordName,
            request.Notes);

        if (detailsResult.IsError)
        {
            return detailsResult.Errors;
        }

        var clauses = request.Clauses
            .Select(c => new ContractClause(c.Order, c.Title, c.Body));
        ErrorOr<Success> clausesResult = contract.UpdateClauses(clauses);
        if (clausesResult.IsError)
        {
            return clausesResult.Errors;
        }

        repository.Update(contract);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RentalContractResponse.From(contract);
    }
}
