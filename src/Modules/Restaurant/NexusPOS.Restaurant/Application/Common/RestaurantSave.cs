using ErrorOr;
using MediatR;
using Microsoft.EntityFrameworkCore;
using NexusPOS.Restaurant.Domain;
using NexusPOS.Restaurant.Infrastructure.Persistence;
using NexusPOS.SharedKernel.Domain.Events;
using Npgsql;

namespace NexusPOS.Restaurant.Application.Common;

// Saving restaurant orders. Orders carry a row version, so a save over a change made since they were read
// is refused with `changed` instead of overwriting it.
internal static class RestaurantSave
{
    public static Task<ErrorOr<Success>> SaveAsync(
        RestaurantDbContext dbContext,
        Error changed,
        CancellationToken cancellationToken) =>
        WriteAsync(() => dbContext.SaveChangesAsync(cancellationToken), changed);

    // Writes the paid orders and records their sales as one step. The orders are written first inside a
    // transaction, which also locks them; the sales are recorded next and the orders committed only after.
    // A conflicting change or a failed write records no sale, and a failed sale leaves the orders unpaid, so
    // the till can always try again (POS records one sale per order id).
    public static async Task<ErrorOr<Success>> SaveWithSalesAsync(
        RestaurantDbContext dbContext,
        IReadOnlyList<ExternalSaleCompletedDomainEvent> sales,
        IPublisher publisher,
        Error changed,
        CancellationToken cancellationToken)
    {
        if (sales.Count == 0)
        {
            return await SaveAsync(dbContext, changed, cancellationToken);
        }

        await using (var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken))
        {
            // EF's own save, without the module's event dispatch: the orders' domain events (stock use)
            // wait until the orders are committed.
            ErrorOr<Success> written = await WriteAsync(
                () => ((DbContext)dbContext).SaveChangesAsync(cancellationToken), changed);
            if (written.IsError)
            {
                return written.Errors;
            }

            foreach (ExternalSaleCompletedDomainEvent sale in sales)
            {
                await publisher.Publish(sale, cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }

        // Nothing is left to write; this publishes the orders' domain events now that they are committed.
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success;
    }

    private static async Task<ErrorOr<Success>> WriteAsync(Func<Task<int>> save, Error changed)
    {
        try
        {
            await save();
            return Result.Success;
        }
        catch (DbUpdateConcurrencyException)
        {
            return changed;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Two calls with the same client order id: the first one made the order.
            return RestaurantErrors.OrderIdTaken;
        }
    }
}
