using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Zatca.Application.Common;

namespace NexusPOS.Zatca.Application.Queries.GetZatcaInvoice;

public sealed record GetZatcaInvoiceQuery(Guid OrderId) : IQuery<ZatcaInvoiceResponse>;
