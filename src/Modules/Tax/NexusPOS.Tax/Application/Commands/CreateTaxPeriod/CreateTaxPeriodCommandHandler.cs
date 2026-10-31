using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.CreateTaxPeriod;

internal sealed class CreateTaxPeriodCommandHandler(TaxConfigDbContext db)
    : ICommandHandler<CreateTaxPeriodCommand, TaxPeriodResponse>
{
    public async Task<ErrorOr<TaxPeriodResponse>> Handle(
        CreateTaxPeriodCommand request,
        CancellationToken cancellationToken)
    {
        TaxPeriod? conflict = await db.TaxPeriods
            .Where(p => p.TenantId == request.TenantId &&
                        p.Status == TaxPeriodStatus.Open &&
                        p.StartDate <= request.EndDate &&
                        p.EndDate >= request.StartDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (conflict is not null)
        {
            return Error.Conflict(
                "TaxPeriod.Overlapping",
                $"An open tax period ({conflict.StartDate:d} – {conflict.EndDate:d}) already covers part of the requested date range. Close it first.");
        }

        TaxPeriod period = TaxPeriod.Create(
            request.TenantId, request.StartDate, request.EndDate, request.Notes);

        db.TaxPeriods.Add(period);
        await db.SaveChangesAsync(cancellationToken);

        return new TaxPeriodResponse(
            period.Id, period.StartDate, period.EndDate,
            period.Status, period.Notes, period.CreatedAt, period.ClosedAt);
    }
}
