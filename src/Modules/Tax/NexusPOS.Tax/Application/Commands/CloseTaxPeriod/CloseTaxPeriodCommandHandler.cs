using ErrorOr;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;
using NexusPOS.Tax.Domain.Entities;
using NexusPOS.Tax.Infrastructure.Persistence;

namespace NexusPOS.Tax.Application.Commands.CloseTaxPeriod;

internal sealed class CloseTaxPeriodCommandHandler(TaxConfigDbContext db)
    : ICommandHandler<CloseTaxPeriodCommand, TaxPeriodResponse>
{
    public async Task<ErrorOr<TaxPeriodResponse>> Handle(
        CloseTaxPeriodCommand request,
        CancellationToken cancellationToken)
    {
        TaxPeriod? period = await db.TaxPeriods
            .FirstOrDefaultAsync(
                p => p.Id == request.PeriodId && p.TenantId == request.TenantId,
                cancellationToken);

        if (period is null)
        {
            return Error.NotFound("TaxPeriod.NotFound", "Tax period not found.");
        }

        if (period.Status == TaxPeriodStatus.Closed)
        {
            return Error.Conflict("TaxPeriod.AlreadyClosed", "Tax period is already closed.");
        }

        period.Close();
        await db.SaveChangesAsync(cancellationToken);

        return new TaxPeriodResponse(
            period.Id, period.StartDate, period.EndDate,
            period.Status, period.Notes, period.CreatedAt, period.ClosedAt);
    }
}
