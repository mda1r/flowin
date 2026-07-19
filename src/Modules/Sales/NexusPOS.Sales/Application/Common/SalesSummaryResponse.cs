namespace NexusPOS.Sales.Application.Common;

public sealed record SalesSummaryResponse(
    Guid BranchId,
    DateOnly SummaryDate,
    string Currency,
    int TotalOrders,
    decimal TotalRevenue,
    decimal TotalDiscounts,
    decimal TotalTax,
    decimal AverageOrderValue);
