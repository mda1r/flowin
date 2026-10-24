using ErrorOr;
using FluentAssertions;
using NexusPOS.Purchasing.Domain;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.ValueObjects;
using NexusPOS.SharedKernel.Domain.Events;

namespace NexusPOS.Purchasing.UnitTests.Domain;

public sealed class PurchaseOrderMaterialsRetryTests
{
    private static readonly Guid _coffee = Guid.NewGuid();

    private static PurchaseOrder Draft() =>
        PurchaseOrder.Create(Guid.NewGuid(), Guid.NewGuid(), new SupplierId(Guid.NewGuid()), null, null);

    [Fact]
    public void Retry_AfterReceive_RaisesTheSameMaterialLinesAgain()
    {
        PurchaseOrder order = Draft();
        order.AddMaterialLine(_coffee, "بن قهوة", 45m, 3m);
        order.Send();
        order.ReceiveAll();
        order.ClearDomainEvents();

        ErrorOr<Success> result = order.RetryInventoryReceipt();

        result.IsError.Should().BeFalse();
        StockMaterialsPurchasedDomainEvent evt = order.DomainEvents.OfType<StockMaterialsPurchasedDomainEvent>().Single();
        evt.PurchaseOrderId.Should().Be(order.Id.Value);
        evt.Lines.Should().ContainSingle().Which.Should().Be(new StockMaterialsPurchasedDomainEvent.Line(_coffee, 3m, 45m));
    }

    [Fact]
    public void Retry_BeforeReceive_IsRejected()
    {
        PurchaseOrder order = Draft();
        order.AddMaterialLine(_coffee, "بن قهوة", 45m, 3m);
        order.Send();

        order.RetryInventoryReceipt().FirstError.Should().Be(PurchasingErrors.PurchaseOrderNotReceived);
    }

    [Fact]
    public void Retry_WithProductLines_RaisesProductReceiptAgain()
    {
        Guid variant = Guid.NewGuid();
        PurchaseOrder order = Draft();
        order.AddLine(variant, "منتج", 10m, 4m);
        order.Send();
        order.ReceiveAll();
        order.ClearDomainEvents();

        order.RetryInventoryReceipt().IsError.Should().BeFalse();

        PurchaseOrderReceivedDomainEvent evt = order.DomainEvents.OfType<PurchaseOrderReceivedDomainEvent>().Single();
        evt.ReceivedItems.Should().ContainSingle().Which.Should().Be(new PurchaseOrderReceivedDomainEvent.Item(variant, 4m, 10m));
        order.DomainEvents.OfType<StockMaterialsPurchasedDomainEvent>().Should().BeEmpty();
    }

    [Fact]
    public void Receive_MaterialOnlyOrder_RaisesNoProductEvent()
    {
        PurchaseOrder order = Draft();
        order.AddMaterialLine(_coffee, "بن قهوة", 45m, 3m);
        order.Send();

        order.ReceiveAll();

        order.DomainEvents.OfType<PurchaseOrderReceivedDomainEvent>().Should().BeEmpty();
    }
}
