using NexusPOS.Hotel.Application.Commands.CreateRentalContract;
using NexusPOS.Hotel.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Hotel.Application.Commands.UpdateRentalContract;

public sealed record UpdateRentalContractCommand(
    Guid ContractId,
    Guid BranchId,
    string TenantName,
    string TenantNationalId,
    string TenantPhone,
    string RoomNumber,
    DateTime StartDate,
    DateTime EndDate,
    decimal MonthlyRent,
    string LandlordName,
    IReadOnlyList<CreateRentalContractClauseDto> Clauses,
    string? Notes = null) : ICommand<RentalContractResponse>;
