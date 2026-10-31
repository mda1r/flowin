using FluentAssertions;
using NexusPOS.POS.Application.Queries.GetActivityLogs;
using NexusPOS.POS.Domain.Entities;

namespace NexusPOS.POS.UnitTests.Application;

public sealed class ActivityLogsQueryTests
{
    private static readonly Guid _branchA = Guid.NewGuid();
    private static readonly Guid _branchB = Guid.NewGuid();
    private static readonly DateTime _base = new(2026, 10, 30, 21, 0, 0, DateTimeKind.Utc);

    private static ActivityLog Log(Guid? branchId, string category, DateTime at, string action = "x") =>
        ActivityLog.Create(branchId, Guid.NewGuid(), "Sara", null, category, action, null, at);

    private static List<ActivityLog> Run(IEnumerable<ActivityLog> logs, GetActivityLogsQuery query) =>
        [.. GetActivityLogsQueryHandler.Apply(logs.AsQueryable(), query)];

    [Fact]
    public void BranchFilter_IncludesTenantWideEntries()
    {
        ActivityLog inA = Log(_branchA, "shift", _base);
        ActivityLog inB = Log(_branchB, "shift", _base.AddMinutes(1));
        ActivityLog tenantWide = Log(null, "user", _base.AddMinutes(2));

        List<ActivityLog> result = Run([inA, inB, tenantWide], new GetActivityLogsQuery(_branchA, null, null, null, 50));

        result.Should().BeEquivalentTo([tenantWide, inA]);
    }

    [Fact]
    public void CategoryAndDateRange_AreAppliedServerSide()
    {
        // Riyadh day 2026-10-31 = [2026-10-30T21:00Z, 2026-10-31T21:00Z)
        DateTime from = _base;
        DateTime to = _base.AddDays(1).AddTicks(-1);
        ActivityLog earlyMorning = Log(_branchA, "order", _base.AddHours(1)); // 01:00 Riyadh, still Oct 31
        ActivityLog dayBefore = Log(_branchA, "order", _base.AddMinutes(-1));
        ActivityLog otherCategory = Log(_branchA, "shift", _base.AddHours(2));

        List<ActivityLog> result = Run(
            [earlyMorning, dayBefore, otherCategory],
            new GetActivityLogsQuery(null, "order", from, to, 50));

        result.Should().ContainSingle().Which.Should().Be(earlyMorning);
    }

    [Fact]
    public void Paging_SkipsOlderPagesNewestFirst()
    {
        List<ActivityLog> logs = [.. Enumerable.Range(0, 5).Select(i => Log(_branchA, "shift", _base.AddMinutes(i), $"a{i}"))];

        List<ActivityLog> page1 = Run(logs, new GetActivityLogsQuery(null, null, null, null, 2));
        List<ActivityLog> page2 = Run(logs, new GetActivityLogsQuery(null, null, null, null, 2, Skip: 2));

        page1.Select(l => l.Action).Should().Equal("a4", "a3");
        page2.Select(l => l.Action).Should().Equal("a2", "a1");
    }

    [Fact]
    public void Paging_WithSameTimestamp_NeitherRepeatsNorSkips()
    {
        // Several entries written in one transaction share OccurredAt.
        List<ActivityLog> logs = [.. Enumerable.Range(0, 5).Select(i => Log(_branchA, "inventory", _base, $"s{i}"))];

        List<ActivityLog> page1 = Run(logs, new GetActivityLogsQuery(null, null, null, null, 3));
        List<ActivityLog> page2 = Run(logs.AsEnumerable().Reverse(), new GetActivityLogsQuery(null, null, null, null, 3, Skip: 3));

        page1.Concat(page2).Should().OnlyHaveUniqueItems().And.BeEquivalentTo(logs);
    }

    [Fact]
    public void PageSize_IsCapped()
    {
        List<ActivityLog> logs = [.. Enumerable.Range(0, 600).Select(i => Log(null, "shift", _base.AddSeconds(i)))];

        Run(logs, new GetActivityLogsQuery(null, null, null, null, 10_000)).Should().HaveCount(GetActivityLogsQueryHandler.MaxPageSize);
    }
}
