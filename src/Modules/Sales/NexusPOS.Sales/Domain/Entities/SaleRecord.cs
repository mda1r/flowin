using NexusPOS.POS.Domain.Enums;
using NexusPOS.Sales.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain;

namespace NexusPOS.Sales.Domain.Entities;

public sealed class SaleRecord : Entity<SaleRecordId>
{
    public Guid OrderId { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid BranchId { get; private set; }
    public string Currency { get; private set; } = string.Empty;
    public decimal TotalAmount { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal SubtotalAmount { get; private set; }
    public PaymentMethod PaymentMethod { get; private set; }
    public DateTime CompletedAt { get; private set; }

    private SaleRecord() { }

    public static SaleRecord Create(
        Guid orderId,
        Guid tenantId,
        Guid branchId,
        string currency,
        decimal totalAmount,
        decimal discountAmount,
        decimal taxAmount,
        decimal subtotalAmount,
        PaymentMethod paymentMethod,
        DateTime completedAt)
    {
        return new SaleRecord
        {
            Id = new SaleRecordId(Guid.NewGuid()),
            OrderId = orderId,
            TenantId = tenantId,
            BranchId = branchId,
            Currency = currency,
            TotalAmount = totalAmount,
            DiscountAmount = discountAmount,
            TaxAmount = taxAmount,
            SubtotalAmount = subtotalAmount,
            PaymentMethod = paymentMethod,
            CompletedAt = completedAt,
        };
    }
}
