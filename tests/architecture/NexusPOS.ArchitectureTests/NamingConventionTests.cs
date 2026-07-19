using System.Reflection;
using NetArchTest.Rules;
using FluentAssertions;

namespace NexusPOS.ArchitectureTests;

public sealed class NamingConventionTests
{
    private static readonly Assembly _sharedKernel = typeof(NexusPOS.SharedKernel.SharedKernelModule).Assembly;

    [Fact]
    public void Commands_Should_End_With_Command()
    {
        TestResult result = Types
            .InAssembly(_sharedKernel)
            .That()
            .ImplementInterface(typeof(NexusPOS.SharedKernel.Application.Messaging.ICommand<>))
            .Should()
            .HaveNameEndingWith("Command")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(because: "all commands must end with 'Command'");
    }

    [Fact]
    public void Queries_Should_End_With_Query()
    {
        TestResult result = Types
            .InAssembly(_sharedKernel)
            .That()
            .ImplementInterface(typeof(NexusPOS.SharedKernel.Application.Messaging.IQuery<>))
            .Should()
            .HaveNameEndingWith("Query")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(because: "all queries must end with 'Query'");
    }

    [Fact]
    public void DomainEvents_Should_End_With_DomainEvent()
    {
        TestResult result = Types
            .InAssembly(_sharedKernel)
            .That()
            .ImplementInterface(typeof(NexusPOS.SharedKernel.Domain.Events.IDomainEvent))
            .Should()
            .HaveNameEndingWith("DomainEvent")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(because: "all domain events must end with 'DomainEvent'");
    }
}
