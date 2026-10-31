using ErrorOr;
using NexusPOS.Hotel.Domain.Enums;
using NexusPOS.Hotel.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Hotel.Domain.Entities;

public sealed class RentalContract : AggregateRoot<RentalContractId>
{
    private readonly List<ContractClause> _clauses = [];

    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public Guid? ReservationId { get; private set; }

    // Tenant (renter) info
    public string TenantName { get; private set; } = string.Empty;
    public string TenantNationalId { get; private set; } = string.Empty;
    public string TenantPhone { get; private set; } = string.Empty;

    // Property info
    public string RoomNumber { get; private set; } = string.Empty;
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public decimal MonthlyRent { get; private set; }
    public string Currency { get; private set; } = "SAR";

    // Landlord info
    public string LandlordName { get; private set; } = string.Empty;

    public ContractStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public DateTime? SignedAt { get; private set; }

    public IReadOnlyList<ContractClause> Clauses => _clauses.AsReadOnly();

    private RentalContract() { }

    public static RentalContract Create(
        Guid tenantId,
        Guid branchId,
        string tenantName,
        string tenantNationalId,
        string tenantPhone,
        string roomNumber,
        DateTime startDate,
        DateTime endDate,
        decimal monthlyRent,
        string landlordName,
        IEnumerable<ContractClause> clauses,
        Guid? reservationId = null,
        string? notes = null)
    {
        var contract = new RentalContract
        {
            Id = new RentalContractId(Guid.NewGuid()),
            TenantId = tenantId,
            BranchId = branchId,
            ReservationId = reservationId,
            TenantName = tenantName.Trim(),
            TenantNationalId = tenantNationalId.Trim(),
            TenantPhone = tenantPhone.Trim(),
            RoomNumber = roomNumber.Trim(),
            StartDate = startDate,
            EndDate = endDate,
            MonthlyRent = monthlyRent,
            LandlordName = landlordName.Trim(),
            Currency = "SAR",
            Status = ContractStatus.Draft,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        contract._clauses.AddRange(clauses.OrderBy(c => c.Order));
        return contract;
    }

    public void UpdateClauses(IEnumerable<ContractClause> clauses)
    {
        _clauses.Clear();
        _clauses.AddRange(clauses.OrderBy(c => c.Order));
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(
        string tenantName,
        string tenantNationalId,
        string tenantPhone,
        string roomNumber,
        DateTime startDate,
        DateTime endDate,
        decimal monthlyRent,
        string landlordName,
        string? notes)
    {
        TenantName = tenantName.Trim();
        TenantNationalId = tenantNationalId.Trim();
        TenantPhone = tenantPhone.Trim();
        RoomNumber = roomNumber.Trim();
        StartDate = startDate;
        EndDate = endDate;
        MonthlyRent = monthlyRent;
        LandlordName = landlordName.Trim();
        Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public ErrorOr<Success> Activate()
    {
        if (Status == ContractStatus.Cancelled)
        {
            return HotelErrors.ContractCancelled;
        }

        Status = ContractStatus.Active;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Sign()
    {
        if (Status == ContractStatus.Cancelled)
        {
            return HotelErrors.ContractCancelled;
        }

        Status = ContractStatus.Executed;
        SignedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }

    public ErrorOr<Success> Cancel()
    {
        if (Status == ContractStatus.Executed)
        {
            return HotelErrors.ContractAlreadySigned;
        }

        Status = ContractStatus.Cancelled;
        UpdatedAt = DateTime.UtcNow;
        return Result.Success;
    }
}
