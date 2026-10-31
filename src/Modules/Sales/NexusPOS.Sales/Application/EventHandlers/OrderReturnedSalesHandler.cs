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

        if (summary is null)
        {
            return;
        }

        summary.RecordReturn(notification.RefundAmount);
        salesSummaryRepository.Update(summary);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
