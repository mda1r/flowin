using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.ValueObjects;
using NexusPOS.POS.Infrastructure.Persistence;

namespace NexusPOS.POS.Application.Common;

/// <summary>
/// Sums a shift's completed sales and cash refunds in the database, so a busy shift is never cut off
/// by a page size. Orders are not tied to a cashier, so this covers the branch since the shift opened.
/// </summary>
internal static class ShiftTotalsReader
{
    public static async Task<ShiftTotals> ReadAsync(
        PosDbContext dbContext,
        CashierShift shift,
        CancellationToken cancellationToken)
    {
        List<ShiftPaymentRow> rows = await SalesByMethod(dbContext, shift).ToListAsync(cancellationToken);
        ShiftRefunds refunds = await RefundsAsync(dbContext, shift, cancellationToken);

        return ShiftTotals.From(rows, refunds);
    }

    // Every return given during the shift, by how the money went back, with the VAT inside each refund
    // (at the tax rate of the sale it came from).
    private static async Task<ShiftRefunds> RefundsAsync(
        PosDbContext dbContext, CashierShift shift, CancellationToken cancellationToken)
    {
        DateTime from = shift.OpenedAt;
        DateTime? to = shift.ClosedAt;
        var returns = await dbContext.ReturnOrders
            .AsNoTracking()
            .Where(r => r.BranchId == shift.BranchId && r.CreatedAt >= from && (to == null || r.CreatedAt <= to))
            .Select(r => new { r.OriginalOrderId, r.RefundMethod, r.RefundAmount })
            .ToListAsync(cancellationToken);
        if (returns.Count == 0)
        {
            return ShiftRefunds.None;
        }

        List<OrderId> orderIds = [.. returns.Select(r => new OrderId(r.OriginalOrderId)).Distinct()];
        Dictionary<Guid, decimal> taxRates = await dbContext.Orders
            .AsNoTracking()
            .Where(o => orderIds.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id.Value, o => o.TaxRate, cancellationToken);

        return new ShiftRefunds(
            returns.Sum(r => r.RefundAmount),
            returns.Where(r => r.RefundMethod == RefundMethod.Cash).Sum(r => r.RefundAmount),
            returns.Where(r => r.RefundMethod == RefundMethod.Card).Sum(r => r.RefundAmount),
            returns.Sum(r => ReturnOrder.RefundTaxOf(r.RefundAmount, taxRates.GetValueOrDefault(r.OriginalOrderId, 0m))));
    }

    internal static IQueryable<ShiftPaymentRow> SalesByMethod(PosDbContext dbContext, CashierShift shift)
    {
        DateTime from = shift.OpenedAt;
        DateTime? to = shift.ClosedAt;

        return dbContext.Orders
            .Where(o => o.BranchId == shift.BranchId
                     && o.Status == OrderStatus.Completed
                     && o.CompletedAt >= from
                     && (to == null || o.CompletedAt <= to))
            .GroupBy(o => o.PaymentMethod)
            .Select(g => new ShiftPaymentRow(
                g.Key,
                g.Count(),
                g.Sum(o => o.TotalAmount),
                g.Sum(o => o.TaxAmount),
                g.Sum(o => o.SplitCash ?? 0m),
                g.Sum(o => o.SplitCard ?? 0m)));
    }

    internal static IQueryable<ReturnOrder> CashRefunds(PosDbContext dbContext, CashierShift shift)
    {
        DateTime from = shift.OpenedAt;
        DateTime? to = shift.ClosedAt;

        return dbContext.ReturnOrders
            .Where(r => r.BranchId == shift.BranchId
                     && r.RefundMethod == RefundMethod.Cash
                     && r.CreatedAt >= from
                     && (to == null || r.CreatedAt <= to));
    }
}
