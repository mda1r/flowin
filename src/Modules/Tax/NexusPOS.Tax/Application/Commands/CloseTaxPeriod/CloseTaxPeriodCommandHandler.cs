using ErrorOr;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
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
        // Waits for any ledger sync of this period to finish before freezing its figures.
        await using IDbContextTransaction? periodLock =
            await TaxPeriodLock.AcquireAsync(db, request.PeriodId, cancellationToken);

        TaxPeriod? period = await db.TaxPeriods
            .FirstOrDefaultAsync(
                p => p.Id == request.PeriodId && p.TenantId == request.TenantId,
                cancellationToken);

        if (period is null)
        {
            return Error.NotFound("TaxPeriod.NotFound", "الفترة الضريبية غير موجودة");
        }

        if (period.Status == TaxPeriodStatus.Closed)
        {
            return Error.Conflict("TaxPeriod.AlreadyClosed", "الفترة الضريبية مغلقة مسبقاً");
        }

        period.Close();
        await db.SaveChangesAsync(cancellationToken);

        if (periodLock is not null)
        {
            await periodLock.CommitAsync(cancellationToken);
        }

        return new TaxPeriodResponse(
            period.Id, period.StartDate, period.EndDate,
            period.Status, period.Notes, period.CreatedAt, period.ClosedAt);
    }
}
