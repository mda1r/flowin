using FluentAssertions;
using NexusPOS.Purchasing.Application.Common;
using NexusPOS.Purchasing.Domain.Entities;
using NexusPOS.Purchasing.Domain.ValueObjects;

namespace NexusPOS.Purchasing.UnitTests.Application;

public sealed class PurchasingMapperTests
{
    private static PurchaseOrder NewOrder() =>
        PurchaseOrder.Create(Guid.NewGuid(), Guid.NewGuid(), new SupplierId(Guid.NewGuid()), null, null);

    [Fact]
    public void ToResponse_WithSupplierName_CarriesIt()
    {
        PurchaseOrderResponse response = PurchasingMapper.ToResponse(NewOrder(), "Al Marai");

        response.SupplierName.Should().Be("Al Marai");
    }

    [Fact]
    public void ToResponse_WithoutSupplierName_LeavesItNull()
    {
        PurchaseOrderResponse response = PurchasingMapper.ToResponse(NewOrder());

        response.SupplierName.Should().BeNull();
    }
}
