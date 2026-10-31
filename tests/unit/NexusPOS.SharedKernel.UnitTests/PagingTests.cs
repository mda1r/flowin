using FluentAssertions;
using NexusPOS.SharedKernel.Application;

namespace NexusPOS.SharedKernel.UnitTests;

public sealed class PagingTests
{
    [Theory]
    [InlineData(0, 1)]
    [InlineData(-5, 1)]
    [InlineData(1, 1)]
    [InlineData(7, 7)]
    public void Page_IsNeverBelowOne(int requested, int expected) =>
        Paging.Page(requested).Should().Be(expected);

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-1, 1)]
    [InlineData(20, 20)]
    [InlineData(200, 200)]
    [InlineData(1_000_000, Paging.MaxPageSize)]
    public void Size_IsClampedToTheDefaultCap(int requested, int expected) =>
        Paging.Size(requested).Should().Be(expected);

    [Fact]
    public void Size_HonoursAHigherCapWhenGiven()
    {
        Paging.Size(500, 500).Should().Be(500);
        Paging.Size(5000, 500).Should().Be(500);
    }

    [Fact]
    public void FirstPageOffset_IsZeroForAnyBadInput()
    {
        int page = Paging.Page(0);
        int size = Paging.Size(0);

        ((page - 1) * size).Should().Be(0);
    }
}
