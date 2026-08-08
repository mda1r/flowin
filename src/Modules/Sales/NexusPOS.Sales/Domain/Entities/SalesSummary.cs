using NexusPOS.Sales.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Sales.Domain.Entities;

public sealed class SalesSummary : AggregateRoot<SalesSummaryId>
{
    public Guid BranchId { get; private set; }
    public DateOnly SummaryDate { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public int TotalOrders { get; private set; }
    public decimal TotalRevenue { get; private set; }
    public decimal TotalDiscounts { get; private set; }
    public decimal TotalTax { get; private set; }
    public decimal AverageOrderValue => TotalOrders > 0
        ? Math.Round(TotalRevenue / TotalOrders, 4)
        : 0m;

    private SalesSummary() { }

    public static SalesSummary CreateForDate(Guid branchId, DateOnly date, string currency)
    {
        return new SalesSummary
        {
            Id = new SalesSummaryId(Guid.NewGuid()),
            BranchId = branchId,
            SummaryDate = date,
            Currency = currency,
        };
    }

    public void RecordSale(decimal revenue, decimal discount, decimal tax)
    {
        TotalOrders++;
        TotalRevenue += revenue;
        TotalDiscounts += discount;
        TotalTax += tax;
    }

    public void RecordReturn(decimal refundAmount)
    {
        TotalRevenue -= refundAmount;
    }
}
