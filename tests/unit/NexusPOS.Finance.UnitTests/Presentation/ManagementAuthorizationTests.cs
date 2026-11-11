using System.Reflection;
using System.Security.Claims;
using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NexusPOS.Finance.Application.Commands.CreateExpense;
using NexusPOS.Finance.Application.Common;
using NexusPOS.Finance.Domain.Enums;
using NexusPOS.Finance.Presentation;

namespace NexusPOS.Finance.UnitTests.Presentation;

// Management writes must be refused for Cashier/Staff tokens; hiding the buttons is not enough.
public sealed class ManagementAuthorizationTests
{
    [Theory]
    [InlineData(nameof(ExpensesController.ApproveExpense))]
    [InlineData(nameof(ExpensesController.VoidExpense))]
    [InlineData(nameof(ExpensesController.UpdateExpense))]
    public void ExpensesController_WriteAction_RequiresPolicy(string action) =>
        PolicyOf(typeof(ExpensesController), action).Should().Be("OwnerManagerOrAccountant");

    [Theory]
    [InlineData(true, true, true)]
    [InlineData(true, false, false)]
    [InlineData(false, true, false)]
    public async Task CreateExpense_ApproveNow_OnlyHonouredForApprovers(bool requested, bool mayApprove, bool expected)
    {
        CreateExpenseCommand? sent = null;
        Mock<ISender> mediator = new();
        mediator
            .Setup(m => m.Send(It.IsAny<CreateExpenseCommand>(), It.IsAny<CancellationToken>()))
            .Callback<IRequest<ErrorOr<ExpenseResponse>>, CancellationToken>((c, _) => sent = (CreateExpenseCommand)c)
            .ReturnsAsync(Response());

        Mock<IAuthorizationService> authorization = new();
        authorization
            .Setup(a => a.AuthorizeAsync(It.IsAny<ClaimsPrincipal>(), It.IsAny<object?>(), "OwnerManagerOrAccountant"))
            .ReturnsAsync(mayApprove ? AuthorizationResult.Success() : AuthorizationResult.Failed());

        ExpensesController controller = new(mediator.Object, authorization.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };

        await controller.CreateExpense(
            Guid.NewGuid(),
            new CreateExpenseRequest(ExpenseCategory.Rent, 5000m, "Rent", new DateOnly(2026, 10, 1), ApproveNow: requested),
            CancellationToken.None);

        sent.Should().NotBeNull();
        sent!.ApproveNow.Should().Be(expected);
    }

    private static ExpenseResponse Response() => new(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), ExpenseCategory.Rent, 5000m, "SAR", "Rent",
        new DateOnly(2026, 10, 1), ExpenseStatus.Pending, null, null, null, DateTime.UtcNow);

    private static string? PolicyOf(Type controller, string action) =>
        controller.GetMethod(action)!.GetCustomAttributes<AuthorizeAttribute>().SingleOrDefault()?.Policy;
}
