using ErrorOr;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Repositories;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.Hotel.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CreateRentalContract;

internal sealed class CreateRentalContractCommandHandler(
    IRentalContractRepository repository,
    HotelDbContext dbContext)
    : ICommandHandler<CreateRentalContractCommand, RentalContractResponse>
{
    public async Task<ErrorOr<RentalContractResponse>> Handle(
        CreateRentalContractCommand request,
        CancellationToken cancellationToken)
    {
        var clauses = request.Clauses
            .Select(c => new ContractClause(c.Order, c.Title, c.Body));

        RentalContract contract = RentalContract.Create(
            request.TenantId,
            request.BranchId,
            request.TenantName,
            request.TenantNationalId,
            request.TenantPhone,
            request.RoomNumber,
            request.StartDate,
            request.EndDate,
            request.MonthlyRent,
            request.LandlordName,
            clauses,
            request.ReservationId,
            request.Notes);

        repository.Add(contract);
        await dbContext.SaveChangesAsync(cancellationToken);

        return RentalContractResponse.From(contract);
    }
}
