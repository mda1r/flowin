using ErrorOr;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Zatca.Application.Common;
using NexusPOS.Zatca.Domain;
using NexusPOS.Zatca.Domain.Entities;
using NexusPOS.Zatca.Domain.Repositories;

namespace NexusPOS.Zatca.Application.Queries.GetZatcaInvoice;

internal sealed class GetZatcaInvoiceQueryHandler(IZatcaInvoiceRepository repository)
    : IQueryHandler<GetZatcaInvoiceQuery, ZatcaInvoiceResponse>
{
    public async Task<ErrorOr<ZatcaInvoiceResponse>> Handle(
        GetZatcaInvoiceQuery request,
        CancellationToken cancellationToken)
    {
        ZatcaInvoice? invoice = await repository.FindByOrderIdAsync(request.OrderId, cancellationToken);

        if (invoice is null)
        {
            return ZatcaErrors.InvoiceNotFound;
        }

        return new ZatcaInvoiceResponse(
            invoice.Id,
            invoice.OrderId,
            invoice.InvoiceNumber,
            invoice.InvoiceDate,
            invoice.SellerName,
            invoice.SellerVatNumber,
            invoice.SubtotalAmount,
            invoice.TaxAmount,
            invoice.TotalAmount,
            invoice.Currency,
            invoice.QrCodeBase64,
            invoice.XmlContent,
            invoice.Phase,
            invoice.CreatedAt);
    }
}
