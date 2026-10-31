using MediatR;
using NexusPOS.POS.Domain.Events;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;
using NexusPOS.SharedKernel.Infrastructure.Persistence;

namespace NexusPOS.Sales.Application.EventHandlers;

internal sealed class OrderCompletedEventHandler(
    ISaleRecordRepository saleRecordRepository,
    ISalesSummaryRepository salesSummaryRepository,
    IUnitOfWork unitOfWork)
    : INotificationHandler<OrderCompletedDomainEvent>
{
    public async Task Handle(OrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        SaleRecord record = SaleRecord.Create(
            notification.OrderId,
            notification.TenantId,
            notification.BranchId,
            notification.Currency,
            notification.Total,
            notification.DiscountAmount,
            notification.TaxAmount,
            notification.SubtotalAmount,
            notification.PaymentMethod,
            notification.OccurredAt);

        saleRecordRepository.Add(record);

        DateOnly saleDate = DateOnly.FromDateTime(notification.OccurredAt);
        SalesSummary? summary = await salesSummaryRepository.FindByBranchAndDateAsync(
            notification.BranchId, saleDate, cancellationToken);

        if (summary is null)
        {
            summary = SalesSummary.CreateForDate(notification.BranchId, saleDate, notification.Currency);
            summary.RecordSale(notification.Total, notification.DiscountAmount, notification.TaxAmount);
            salesSummaryRepository.Add(summary);
        }
        else
        {
            summary.RecordSale(notification.Total, notification.DiscountAmount, notification.TaxAmount);
            salesSummaryRepository.Update(summary);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
