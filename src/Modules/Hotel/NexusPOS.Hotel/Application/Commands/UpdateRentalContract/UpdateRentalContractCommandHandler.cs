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

        if (contract is null)
        {
            return HotelErrors.ContractNotFound;
        }

        contract.UpdateDetails(
            request.TenantName,
            request.TenantNationalId,
            request.TenantPhone,
            request.RoomNumber,
            request.StartDate,
            request.EndDate,
            request.MonthlyRent,
            request.LandlordName,
            request.Notes);

        var clauses = request.Clauses
            .Select(c => new ContractClause(c.Order, c.Title, c.Body));
        contract.UpdateClauses(clauses);

        repository.Update(contract);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RentalContractResponse.From(contract);
    }
}
