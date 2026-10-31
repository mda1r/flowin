using ErrorOr;
using FluentAssertions;
using Moq;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Application.Queries.ListOrders;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Repositories;

namespace NexusPOS.POS.UnitTests.Application;

public sealed class ListOrdersQueryHandlerTests
{
    private static readonly Guid _branchId = Guid.NewGuid();
    private static readonly DateTime _from = new(2026, 10, 31, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime _to = new(2026, 10, 31, 23, 59, 59, DateTimeKind.Utc);

    private static Order CompletedOrder(long number)
    {
        Order order = Order.Create(Guid.NewGuid(), _branchId, "SAR", taxRate: 0.15m);
        order.AddLine(Guid.NewGuid(), "لاتيه", "", 20m, 0m, 1m);
        order.AssignNumber(number);
        order.Complete(PaymentMethod.Cash, 100m);
        return order;
    }

    [Fact]
    public async Task Number_IsLookedUpAcrossAllDates()
    {
        Mock<IOrderRepository> repo = new();
        repo.Setup(r => r.FindByBranchAsync(_branchId, OrderStatus.Completed, null, null, 1, 5, 1024, It.IsAny<CancellationToken>()))
            .ReturnsAsync([CompletedOrder(1024)]);

        ErrorOr<IReadOnlyList<OrderResponse>> result = await new ListOrdersQueryHandler(repo.Object)
            .Handle(new ListOrdersQuery(_branchId, OrderStatus.Completed, _from, _to, 1, 5, 1024), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Should().ContainSingle().Which.Number.Should().Be(1024);
        repo.Verify(r => r.FindByBranchAsync(_branchId, OrderStatus.Completed, null, null, 1, 5, 1024, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task WithoutNumber_TheDateRangeStillApplies()
    {
        Mock<IOrderRepository> repo = new();
        repo.Setup(r => r.FindByBranchAsync(_branchId, null, _from, _to, 1, 50, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        ErrorOr<IReadOnlyList<OrderResponse>> result = await new ListOrdersQueryHandler(repo.Object)
            .Handle(new ListOrdersQuery(_branchId, null, _from, _to), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Should().BeEmpty();
        repo.Verify(r => r.FindByBranchAsync(_branchId, null, _from, _to, 1, 50, null, It.IsAny<CancellationToken>()), Times.Once);
    }
}
