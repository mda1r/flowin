using NetArchTest.Rules;
using FluentAssertions;

namespace NexusPOS.ArchitectureTests;

public sealed class ModuleIndependenceTests
{
    private static readonly string[] _moduleNamespaces =
    [
        "NexusPOS.IAM",
        "NexusPOS.Organization",
        "NexusPOS.Catalog",
        "NexusPOS.Inventory",
        "NexusPOS.POS",
        "NexusPOS.Sales",
        "NexusPOS.Purchasing",
        "NexusPOS.CRM",
        "NexusPOS.Finance",
        "NexusPOS.Restaurant",
        "NexusPOS.Hotel",
        "NexusPOS.Gaming",
    ];

    [Fact]
    public void Modules_Should_Not_Depend_On_Each_Other_Directly()
    {
        foreach (string module in _moduleNamespaces)
        {
            foreach (string other in _moduleNamespaces)
            {
                if (module == other) { continue; }

                TestResult result = Types
                    .InAssembly(typeof(NexusPOS.IAM.IamModule).Assembly)
                    .That()
                    .ResideInNamespace(module)
                    .Should()
                    .NotHaveDependencyOn(other)
                    .GetResult();

                result.IsSuccessful.Should().BeTrue(
                    because: $"{module} must not depend on {other} — modules communicate via domain events only");
            }
        }
    }

    [Fact]
    public void SharedKernel_Should_Not_Depend_On_Any_Module()
    {
        foreach (string module in _moduleNamespaces)
        {
            TestResult result = Types
                .InAssembly(typeof(NexusPOS.SharedKernel.SharedKernelModule).Assembly)
                .Should()
                .NotHaveDependencyOn(module)
                .GetResult();

            result.IsSuccessful.Should().BeTrue(
                because: $"SharedKernel must not depend on {module}");
        }
    }
}
