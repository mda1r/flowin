using NexusPOS.Hotel.Domain.Entities;
using NexusPOS.Hotel.Domain.Enums;

namespace NexusPOS.Hotel.Application.Common;

public sealed record ContractClauseDto(int Order, string Title, string Body);

public sealed record RentalContractResponse(
    Guid Id,
    Guid BranchId,
    Guid? ReservationId,
    string TenantName,
    string TenantNationalId,
    string TenantPhone,
    string RoomNumber,
    DateTime StartDate,
    DateTime EndDate,
    decimal MonthlyRent,
    string Currency,
    string LandlordName,
    ContractStatus Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime? SignedAt,
    IReadOnlyList<ContractClauseDto> Clauses)
{
    public static RentalContractResponse From(RentalContract c) => new(
        c.Id.Value,
        c.BranchId,
        c.ReservationId,
        c.TenantName,
        c.TenantNationalId,
        c.TenantPhone,
        c.RoomNumber,
        c.StartDate,
        c.EndDate,
        c.MonthlyRent,
        c.Currency,
        c.LandlordName,
        c.Status,
        c.Notes,
        c.CreatedAt,
        c.SignedAt,
        c.Clauses.Select(cl => new ContractClauseDto(cl.Order, cl.Title, cl.Body)).ToList());
}
