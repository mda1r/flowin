using MediatR;
using NexusPOS.POS.Domain.Events;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Sales.Application.EventHandlers;

internal sealed class OrderReturnedSalesHandler(
    ISalesSummaryRepository salesSummaryRepository,
    IUnitOfWork unitOfWork)
    : INotificationHandler<ReturnOrderCompletedDomainEvent>
{
    public async Task Handle(ReturnOrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        DateOnly returnDate = DateOnly.FromDateTime(notification.OccurredAt);
        SalesSummary? summary = await salesSummaryRepository.FindByBranchAndDateAsync(
            notification.BranchId, returnDate, cancellationToken);

        // A refund on a day with no sales yet (an older sale brought back) still has to show in that day's totals.
        if (summary is null)
        {
            summary = SalesSummary.CreateForDate(notification.BranchId, returnDate, notification.Currency);
            summary.RecordReturn(notification.RefundAmount, notification.TaxAmount);
            salesSummaryRepository.Add(summary);
        }
        else
        {
            summary.RecordReturn(notification.RefundAmount, notification.TaxAmount);
            salesSummaryRepository.Update(summary);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
