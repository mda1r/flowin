using Microsoft.EntityFrameworkCore;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.SharedKernel.Application.Services;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.POS.Infrastructure.Persistence;

internal sealed class ExternalSaleInvoices(PosDbContext db) : IExternalSaleInvoices
{
    public async Task<long?> FindNumberAsync(string source, Guid sourceReferenceId, CancellationToken cancellationToken = default)
    {
        OrderSource orderSource = source switch
        {
            ExternalSaleCompletedDomainEvent.Gaming => OrderSource.Gaming,
            ExternalSaleCompletedDomainEvent.Restaurant => OrderSource.Restaurant,
            _ => OrderSource.Pos,
        };

        return await db.Orders
            .Where(o => o.Source == orderSource && o.SourceReferenceId == sourceReferenceId)
            .Select(o => o.Number)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
