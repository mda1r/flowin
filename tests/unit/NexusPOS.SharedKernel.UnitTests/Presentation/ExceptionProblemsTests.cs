using System.Data.Common;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using NexusPOS.SharedKernel.Domain.Exceptions;
using NexusPOS.SharedKernel.Presentation;

namespace NexusPOS.SharedKernel.UnitTests.Presentation;

public sealed class ExceptionProblemsTests
{
    private sealed class FakeDbException(string sqlState, string message) : DbException(message)
    {
        public override string SqlState => sqlState;
    }

    [Fact]
    public void UniqueViolation_Is409WithoutLeakingTheConstraintName()
    {
        DbUpdateException exception = new("save failed",
            new FakeDbException("23505", "duplicate key value violates unique constraint \"ix_products_sku\""));

        ExceptionProblem problem = ExceptionProblems.Map(exception);

        problem.StatusCode.Should().Be(409);
        problem.Detail.Should().Be(ExceptionProblems.DuplicateDetail);
        problem.Detail.Should().NotContain("ix_");
    }

    [Fact]
    public void ForeignKeyViolation_Is409()
    {
        ExceptionProblem problem = ExceptionProblems.Map(
            new DbUpdateException("save failed", new FakeDbException("23503", "violates foreign key constraint")));

        problem.StatusCode.Should().Be(409);
        problem.Detail.Should().Be(ExceptionProblems.InUseDetail);
    }

    [Fact]
    public void ConcurrencyConflict_Is409AskingToRefresh()
    {
        ExceptionProblem problem = ExceptionProblems.Map(new DbUpdateConcurrencyException("row changed"));

        problem.StatusCode.Should().Be(409);
        problem.Detail.Should().Be(ExceptionProblems.ConcurrencyDetail);
    }

    [Fact]
    public void UnknownException_Is500WithAGenericArabicDetail()
    {
        ExceptionProblem problem = ExceptionProblems.Map(new FormatException("Input string was not in a correct format."));

        problem.StatusCode.Should().Be(500);
        problem.Detail.Should().Be(ExceptionProblems.UnexpectedDetail);
    }

    [Fact]
    public void OtherDatabaseErrors_StayGeneric()
    {
        ExceptionProblem problem = ExceptionProblems.Map(
            new FakeDbException("42P01", "relation \"tenant_x.orders\" does not exist"));

        problem.StatusCode.Should().Be(500);
        problem.Detail.Should().NotContain("tenant_");
    }

    [Fact]
    public void DomainException_Is422AndKeepsItsCode()
    {
        ExceptionProblem problem = ExceptionProblems.Map(new DomainException("Money.NegativeAmount", "Money amount cannot be negative."));

        problem.StatusCode.Should().Be(422);
        problem.Title.Should().Be("Money.NegativeAmount");
        problem.Detail.Should().Be(ExceptionProblems.InvalidDataDetail);
    }

    [Fact]
    public void Cancellation_IsAClientAbortOnlyWhenTheRequestWasAborted()
    {
        using CancellationTokenSource aborted = new();
        aborted.Cancel();

        ExceptionProblems.IsClientAbort(new OperationCanceledException(), aborted.Token).Should().BeTrue();
        ExceptionProblems.IsClientAbort(new TaskCanceledException(), CancellationToken.None).Should().BeFalse();
        ExceptionProblems.IsClientAbort(new InvalidOperationException(), aborted.Token).Should().BeFalse();
    }

    [Fact]
    public void ServerSideTimeout_IsNotReportedAsAClientError()
    {
        ExceptionProblem problem = ExceptionProblems.Map(new TaskCanceledException("HttpClient timeout"));

        problem.StatusCode.Should().Be(504);
    }
}
