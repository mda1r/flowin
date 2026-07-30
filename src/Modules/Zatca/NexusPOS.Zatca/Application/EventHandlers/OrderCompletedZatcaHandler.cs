using MediatR;
using NexusPOS.POS.Domain.Events;
using NexusPOS.Zatca.Application.Services;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Domain.Repositories;
using NexusPOS.Zatca.Infrastructure.Persistence;

namespace NexusPOS.Zatca.Application.EventHandlers;

internal sealed class OrderCompletedZatcaHandler(
    IZatcaSettingsRepository settingsRepository,
    IZatcaInvoiceRepository invoiceRepository,
    ZatcaDbContext dbContext)
    : INotificationHandler<OrderCompletedDomainEvent>
{
    public async Task Handle(OrderCompletedDomainEvent notification, CancellationToken cancellationToken)
    {
        ZatcaSettings? settings = await settingsRepository.FindByTenantAsync(notification.TenantId, cancellationToken);

        if (settings is null || string.IsNullOrWhiteSpace(settings.VatRegistrationNumber))
        {
            return;
        }

        string invoiceNumber = settings.IncrementAndGetInvoiceNumber();
        DateTime invoiceDate = notification.OccurredAt;

        string qrCode = ZatcaQrService.GenerateQrBase64(
            settings.SellerName,
            settings.VatRegistrationNumber,
            invoiceDate,
            notification.Total,
            notification.TaxAmount);

        string xml = ZatcaXmlService.GenerateInvoiceXml(
            invoiceNumber,
            Guid.NewGuid(),
            invoiceDate,
            settings.SellerName,
            settings.VatRegistrationNumber,
            notification.SubtotalAmount,
            notification.TaxAmount,
            notification.Total,
            notification.Currency,
            qrCode);

        ZatcaInvoice invoice = ZatcaInvoice.Create(
            notification.TenantId,
            notification.OrderId,
            invoiceNumber,
            invoiceDate,
            settings.SellerName,
            settings.VatRegistrationNumber,
            notification.SubtotalAmount,
            notification.TaxAmount,
            notification.Total,
            notification.Currency,
            qrCode,
            xml,
            ZatcaPhase.Phase1);

        invoiceRepository.Add(invoice);
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
