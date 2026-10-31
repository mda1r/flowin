using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Sales.Application.Common;
using NexusPOS.Sales.Application.Queries.GetDailySummary;
using NexusPOS.Sales.Application.Queries.GetSummaryRange;
using NexusPOS.Sales.Application.Queries.ListSaleRecords;
using NexusPOS.SharedKernel.Application;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.Sales.Presentation;

[ApiController]
[Route("api/v1/branches/{branchId:guid}/sales")]
[Produces("application/json")]
[Authorize]
public sealed class SalesController(ISender mediator) : ControllerBase
{
    /// <summary>Get the daily sales summary for a branch.</summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(SalesSummaryResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDailySummary(
        Guid branchId,
        [FromQuery] DateOnly? date = null,
        CancellationToken cancellationToken = default)
    {
        DateOnly summaryDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        GetDailySummaryQuery query = new(branchId, summaryDate);
        ErrorOr<SalesSummaryResponse> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>Get daily summaries for a date range.</summary>
    [HttpGet("summary/range")]
    [ProducesResponseType(typeof(IReadOnlyList<SalesSummaryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummaryRange(
        Guid branchId,
        [FromQuery] DateOnly dateFrom,
        [FromQuery] DateOnly dateTo,
        CancellationToken cancellationToken = default)
    {
        GetSummaryRangeQuery query = new(branchId, dateFrom, dateTo);
        ErrorOr<IReadOnlyList<SalesSummaryResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    /// <summary>List individual sale records for a branch.</summary>
    [HttpGet("records")]
    [ProducesResponseType(typeof(IReadOnlyList<SaleRecordResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListSaleRecords(
        Guid branchId,
        [FromQuery] DateTime dateFrom,
        [FromQuery] DateTime dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        ListSaleRecordsQuery query = new(branchId, dateFrom, dateTo, Paging.Page(page), Paging.Size(pageSize));
        ErrorOr<IReadOnlyList<SaleRecordResponse>> result = await mediator.Send(query, cancellationToken);

        return result.Match(Ok, MapErrorsToResult);
    }

    private IActionResult MapErrorsToResult(List<Error> errors) => this.ToProblem(errors);
}
