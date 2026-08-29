using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using NexusPOS.Tax.Application.Commands.CloseTaxPeriod;
using NexusPOS.Tax.Application.Commands.CreateTaxPeriod;
using NexusPOS.Tax.Application.Commands.DeleteExpenseInvoice;
using NexusPOS.Tax.Application.Commands.RecordExpenseInvoice;
using NexusPOS.Tax.Application.Commands.RefreshTaxLedger;
using NexusPOS.Tax.Application.Commands.ScanAnomalies;
using NexusPOS.Tax.Application.Commands.TaxAiChat;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Application.Queries.GetTaxAnomalies;
using NexusPOS.Tax.Application.Queries.GetTaxLedger;
using NexusPOS.Tax.Application.Queries.GetTaxOverview;
using NexusPOS.Tax.Application.Queries.GetVatReturnData;
using NexusPOS.Tax.Application.Queries.ListExpenseInvoices;
using NexusPOS.Tax.Application.Queries.ListTaxPeriods;

namespace NexusPOS.Tax.Presentation;

[ApiController]
[Route("api/v1/tax")]
[Produces("application/json")]
[Authorize]
public sealed class TaxController(ISender mediator, ITenantContext tenantContext, ITenantSubscriptionChecker subscriptionChecker) : ControllerBase
{
    private Guid TenantId =>
        tenantContext.TenantId ?? throw new InvalidOperationException("Tenant context not set.");

    // ── Periods ───────────────────────────────────────────────────────────────

    [HttpGet("periods")]
    [ProducesResponseType(typeof(List<TaxPeriodResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPeriods(CancellationToken cancellationToken)
    {
        ErrorOr<List<TaxPeriodResponse>> result =
            await mediator.Send(new ListTaxPeriodsQuery(TenantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost("periods")]
    [ProducesResponseType(typeof(TaxPeriodResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreatePeriod(
        [FromBody] CreateTaxPeriodRequest request,
        CancellationToken cancellationToken)
    {
        CreateTaxPeriodCommand command = new(TenantId, request.StartDate, request.EndDate, request.Notes);
        ErrorOr<TaxPeriodResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            period => CreatedAtAction(nameof(ListPeriods), period),
            MapErrors);
    }

    [HttpPut("periods/{periodId:guid}/close")]
    [ProducesResponseType(typeof(TaxPeriodResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ClosePeriod(Guid periodId, CancellationToken cancellationToken)
    {
        CloseTaxPeriodCommand command = new(periodId, TenantId);
        ErrorOr<TaxPeriodResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    // ── Overview ──────────────────────────────────────────────────────────────

    [HttpGet("overview")]
    [ProducesResponseType(typeof(TaxOverviewResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview(
        [FromQuery] Guid periodId,
        CancellationToken cancellationToken)
    {
        await mediator.Send(new RefreshTaxLedgerCommand(periodId, TenantId), cancellationToken);
        ErrorOr<TaxOverviewResponse> result =
            await mediator.Send(new GetTaxOverviewQuery(periodId, TenantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    // ── Ledger ────────────────────────────────────────────────────────────────

    [HttpGet("ledger")]
    [ProducesResponseType(typeof(TaxLedgerResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLedger(
        [FromQuery] Guid periodId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        ErrorOr<TaxLedgerResult> result =
            await mediator.Send(new GetTaxLedgerQuery(periodId, TenantId, page, pageSize), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost("ledger/refresh")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> RefreshLedger(
        [FromQuery] Guid periodId,
        CancellationToken cancellationToken)
    {
        ErrorOr<int> result =
            await mediator.Send(new RefreshTaxLedgerCommand(periodId, TenantId), cancellationToken);
        return result.Match(count => Ok(count), MapErrors);
    }

    // ── Anomalies ─────────────────────────────────────────────────────────────

    [HttpGet("anomalies")]
    [ProducesResponseType(typeof(List<TaxAnomalyResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAnomalies(
        [FromQuery] Guid periodId,
        [FromQuery] bool includeResolved = false,
        CancellationToken cancellationToken = default)
    {
        ErrorOr<List<TaxAnomalyResponse>> result =
            await mediator.Send(
                new GetTaxAnomaliesQuery(periodId, TenantId, includeResolved),
                cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost("anomalies/scan")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> ScanAnomalies(
        [FromQuery] Guid periodId,
        CancellationToken cancellationToken)
    {
        ErrorOr<int> result =
            await mediator.Send(new ScanAnomaliesCommand(periodId, TenantId), cancellationToken);
        return result.Match(count => Ok(count), MapErrors);
    }

    // ── VAT Return ────────────────────────────────────────────────────────────

    [HttpGet("vat-return")]
    [ProducesResponseType(typeof(VatReturnResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetVatReturn(
        [FromQuery] Guid periodId,
        CancellationToken cancellationToken)
    {
        ErrorOr<VatReturnResponse> result =
            await mediator.Send(new GetVatReturnDataQuery(periodId, TenantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    // ── Expense Invoices ──────────────────────────────────────────────────────

    [HttpGet("expenses")]
    [ProducesResponseType(typeof(List<TaxExpenseInvoiceResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListExpenses(
        [FromQuery] Guid? periodId = null,
        CancellationToken cancellationToken = default)
    {
        ErrorOr<List<TaxExpenseInvoiceResponse>> result =
            await mediator.Send(new ListExpenseInvoicesQuery(TenantId, periodId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    [HttpPost("expenses")]
    [ProducesResponseType(typeof(TaxExpenseInvoiceResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> RecordExpense(
        [FromBody] RecordExpenseInvoiceRequest request,
        CancellationToken cancellationToken)
    {
        RecordExpenseInvoiceCommand command = new(
            TenantId, request.PeriodId, request.SupplierName, request.SupplierVatNumber,
            request.InvoiceNumber, request.InvoiceDate, request.BaseAmount, request.TaxAmount,
            request.TaxRate, request.Currency, request.Notes);
        ErrorOr<TaxExpenseInvoiceResponse> result = await mediator.Send(command, cancellationToken);
        return result.Match(
            invoice => CreatedAtAction(nameof(ListExpenses), invoice),
            MapErrors);
    }

    [HttpDelete("expenses/{invoiceId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteExpense(Guid invoiceId, CancellationToken cancellationToken)
    {
        ErrorOr<bool> result =
            await mediator.Send(new DeleteExpenseInvoiceCommand(invoiceId, TenantId), cancellationToken);
        return result.Match(_ => NoContent(), MapErrors);
    }

    // ── Tax AI ────────────────────────────────────────────────────────────────

    [HttpPost("ai/chat")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status402PaymentRequired)]
    public async Task<IActionResult> AiChat(
        [FromBody] TaxAiChatRequest request,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<string> features = await subscriptionChecker.GetFeaturesAsync(TenantId, cancellationToken);
        if (!features.Contains("ai"))
        {
            return StatusCode(StatusCodes.Status402PaymentRequired, new { code = "feature_not_available", message = "ميزة الذكاء الاصطناعي غير مفعّلة لهذا الحساب." });
        }

        TaxAiChatCommand command = new(TenantId, request.PeriodId, request.Message);
        ErrorOr<string> result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private IActionResult MapErrors(List<Error> errors)
    {
        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Validation => StatusCodes.Status422UnprocessableEntity,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public sealed record CreateTaxPeriodRequest(DateOnly StartDate, DateOnly EndDate, string? Notes);

public sealed record TaxAiChatRequest(Guid? PeriodId, string Message);

public sealed record RecordExpenseInvoiceRequest(
    Guid? PeriodId,
    string SupplierName,
    string? SupplierVatNumber,
    string InvoiceNumber,
    DateOnly InvoiceDate,
    decimal BaseAmount,
    decimal TaxAmount,
    decimal TaxRate,
    string Currency,
    string? Notes);
