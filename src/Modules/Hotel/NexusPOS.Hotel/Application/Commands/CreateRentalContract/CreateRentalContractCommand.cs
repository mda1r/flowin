using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.CreateRentalContract;

public sealed record CreateRentalContractClauseDto(int Order, string Title, string Body);

public sealed record CreateRentalContractCommand(
    Guid BranchId,
    Guid TenantId,
    string TenantName,
    string TenantNationalId,
    string TenantPhone,
    string RoomNumber,
    DateTime StartDate,
    DateTime EndDate,
    decimal MonthlyRent,
    string LandlordName,
    IReadOnlyList<CreateRentalContractClauseDto> Clauses,
    Guid? ReservationId = null,
    string? Notes = null) : ICommand<RentalContractResponse>;
