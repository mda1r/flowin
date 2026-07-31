namespace NexusPOS.Hotel.Presentation.Requests;

public sealed record ContractClauseRequest(int Order, string Title, string Body);

public sealed record CreateRentalContractRequest(
    string TenantName,
    string TenantNationalId,
    string TenantPhone,
    string RoomNumber,
    DateTime StartDate,
    DateTime EndDate,
    decimal MonthlyRent,
    string LandlordName,
    IReadOnlyList<ContractClauseRequest> Clauses,
    Guid? ReservationId = null,
    string? Notes = null);
