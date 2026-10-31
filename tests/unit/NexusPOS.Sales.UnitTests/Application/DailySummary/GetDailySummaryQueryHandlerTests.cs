using ErrorOr;
using FluentAssertions;
using Moq;
using NexusPOS.Sales.Application.Common;
using NexusPOS.Sales.Application.Queries.GetDailySummary;
using NexusPOS.Sales.Domain.Entities;
using NexusPOS.Sales.Domain.Repositories;

namespace NexusPOS.Sales.UnitTests.Application.DailySummary;

public sealed class GetDailySummaryQueryHandlerTests
{
    [Fact]
    public async Task ADayWithNoSales_IsZeroInRiyals()
    {
        Mock<ISalesSummaryRepository> repo = new();
        repo.Setup(r => r.FindByBranchAndDateAsync(It.IsAny<Guid>(), It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((SalesSummary?)null);

        ErrorOr<SalesSummaryResponse> result = await new GetDailySummaryQueryHandler(repo.Object)
            .Handle(new GetDailySummaryQuery(Guid.NewGuid(), new DateOnly(2026, 10, 31)), CancellationToken.None);

        result.Value.Currency.Should().Be("SAR");
        result.Value.TotalOrders.Should().Be(0);
    }
}
