using ErrorOr;
using FluentAssertions;
using Moq;
using NexusPOS.POS.Application.Common;
using NexusPOS.POS.Application.Queries.ListReturns;
using NexusPOS.POS.Domain.Entities;
using NexusPOS.POS.Domain.Enums;
using NexusPOS.POS.Domain.Repositories;

namespace NexusPOS.POS.UnitTests.Application;

public sealed class ListReturnsQueryHandlerTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private readonly Mock<IReturnOrderRepository> _repository = new();

    private ListReturnsQueryHandler CreateHandler() => new(_repository.Object);

    private static ReturnOrder CreateReturn(decimal unitPrice, decimal quantity, decimal taxRate)
    {
        Order order = Order.Create(_tenantId, _branchId, "SAR", taxRate: taxRate);
        OrderLine line = order.AddLine(Guid.NewGuid(), "Latte", "Large", unitPrice, 4m, quantity).Value;
        order.Complete(PaymentMethod.Cash, order.TotalAmount);

        ErrorOr<ReturnOrder> result = ReturnOrder.Create(
            order, [], [(line.Id.Value, quantity, ReturnReason.CustomerRequest)], RefundMethod.Cash, restockItems: false);

        return result.Value;
    }

    [Fact]
    public async Task Handle_WithDateRange_PassesRangeToRepository()
    {
        DateTime from = new(2026, 10, 30, 21, 0, 0, DateTimeKind.Utc);
        DateTime to = from.AddDays(1);
        _repository
            .Setup(r => r.FindByBranchAsync(_branchId, from, to, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        ErrorOr<IReadOnlyList<ReturnOrderResponse>> result =
            await CreateHandler().Handle(new ListReturnsQuery(_branchId, from, to), CancellationToken.None);

        result.IsError.Should().BeFalse();
        result.Value.Should().BeEmpty();
        _repository.Verify(r => r.FindByBranchAsync(_branchId, from, to, It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithoutDateRange_ListsWholeBranch()
    {
        _repository
            .Setup(r => r.FindByBranchAsync(_branchId, null, null, It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([CreateReturn(10m, 2m, 0.15m)]);
        _repository
            .Setup(r => r.FindOriginalLineCostsAsync(It.IsAny<IReadOnlyCollection<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, decimal>());

        ErrorOr<IReadOnlyList<ReturnOrderResponse>> result =
            await CreateHandler().Handle(new ListReturnsQuery(_branchId), CancellationToken.None);

        result.IsError.Should().BeFalse();
        ReturnOrderResponse response = result.Value.Should().ContainSingle().Subject;
        response.BranchId.Should().Be(_branchId);
        response.RefundMethod.Should().Be(RefundMethod.Cash);
        response.RefundAmount.Should().Be(23m);
        response.Lines.Should().ContainSingle(l => l.Quantity == 2m && l.UnitPrice == 10m);
    }

    [Fact]
    public async Task Handle_WhenFromIsAfterTo_ReturnsValidationErrorWithoutQuerying()
    {
        DateTime to = new(2026, 10, 30, 0, 0, 0, DateTimeKind.Utc);
        DateTime from = to.AddHours(1);

        ErrorOr<IReadOnlyList<ReturnOrderResponse>> result =
            await CreateHandler().Handle(new ListReturnsQuery(_branchId, from, to), CancellationToken.None);

        result.IsError.Should().BeTrue();
        result.FirstError.Type.Should().Be(ErrorType.Validation);
        _repository.Verify(
            r => r.FindByBranchAsync(It.IsAny<Guid>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
