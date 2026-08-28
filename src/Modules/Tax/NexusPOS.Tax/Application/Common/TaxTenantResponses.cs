namespace NexusPOS.Tax.Application.Common;

public sealed record TaxPeriodResponse(
    Guid Id,
    DateOnly StartDate,
    DateOnly EndDate,
    string Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime? ClosedAt);

public sealed record TaxOverviewResponse(
    Guid PeriodId,
    DateOnly StartDate,
    DateOnly EndDate,
    string PeriodStatus,
    decimal TotalOutputVat,
    decimal TotalInputVat,
    decimal NetVatPayable,
    decimal TotalSalesBase,
    decimal TotalPurchasesBase,
    int SaleTransactionCount,
    int PurchaseInvoiceCount,
    int OpenAnomalyCount,
    decimal TaxReadinessScore);

public sealed record TaxLedgerEntryResponse(
    Guid Id,
    string EntryType,
    string TransactionType,
    Guid? ReferenceId,
    string? ReferenceType,
    decimal BaseAmount,
    decimal TaxAmount,
    decimal TaxRate,
    DateOnly EffectiveDate,
    DateTime CreatedAt);

public sealed record TaxLedgerResult(
    List<TaxLedgerEntryResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);

public sealed record TaxAnomalyResponse(
    Guid Id,
    string RuleCode,
    string Severity,
    string Title,
    string Description,
    string? TransactionRef,
    DateTime DetectedAt,
    bool IsResolved,
    DateTime? ResolvedAt);

public sealed record VatReturnResponse(
    Guid PeriodId,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Box1StandardRatedSales,
    decimal Box1OutputVat,
    decimal Box2ZeroRatedSales,
    decimal Box3ExemptSales,
    decimal Box6StandardRatedPurchases,
    decimal Box6InputVat,
    decimal Box7ZeroRatedPurchases,
    decimal Box8ExemptPurchases,
    decimal Box9TotalOutputVat,
    decimal Box10TotalInputVat,
    decimal Box11NetVatDue,
    string Status);

public sealed record TaxExpenseInvoiceResponse(
    Guid Id,
    Guid? PeriodId,
    string SupplierName,
    string? SupplierVatNumber,
    string InvoiceNumber,
    DateOnly InvoiceDate,
    decimal BaseAmount,
    decimal TaxAmount,
    decimal TaxRate,
    string Currency,
    string? Notes,
    DateTime CreatedAt);
