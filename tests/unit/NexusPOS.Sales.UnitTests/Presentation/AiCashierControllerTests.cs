using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using NexusPOS.Sales.Application.Commands.AiCashier;
using NexusPOS.Sales.Presentation;
using NexusPOS.Sales.Presentation.Requests;
using NexusPOS.SharedKernel.Application.Services;
using System.Security.Claims;

namespace NexusPOS.Sales.UnitTests.Presentation;

public sealed class AiCashierControllerTests
{
    private static readonly Guid _tenantId = Guid.NewGuid();
    private static readonly Guid _branchId = Guid.NewGuid();

    private static AiController CreateController(
        Mock<ISender> mediator,
        Mock<ITenantSubscriptionChecker> checker)
    {
        var controller = new AiController(mediator.Object, checker.Object);
        var user = new ClaimsPrincipal(
            new ClaimsIdentity([new Claim("tenant_id", _tenantId.ToString())]));
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user },
        };
        return controller;
    }

    [Fact]
    public async Task CashierAvailable_WhenAiCashierFeatureAbsent_ReturnsFalse()
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(["some_other_feature"]);

        var controller = CreateController(mediator, checker);
        IActionResult actionResult = await controller.CashierAvailable(CancellationToken.None);

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().BeEquivalentTo(new { available = false });
    }

    [Fact]
    public async Task CashierAvailable_WhenAiCashierFeaturePresent_ReturnsTrue()
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(["pos_terminal", "ai_cashier"]);

        var controller = CreateController(mediator, checker);
        IActionResult actionResult = await controller.CashierAvailable(CancellationToken.None);

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().BeEquivalentTo(new { available = true });
    }

    [Fact]
    public async Task Cashier_WhenAiCashierFeatureAbsent_Returns402WithCode()
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync([]);

        var controller = CreateController(mediator, checker);

        IActionResult actionResult = await controller.Cashier(_branchId, new AiCashierRequest([]), CancellationToken.None);

        actionResult.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status402PaymentRequired);

        mediator.Verify(
            m => m.Send(It.IsAny<IRequest<ErrorOr<AiCashierResponse>>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Cashier_WhenFeaturePresent_SendsCommandAndReturnsOk()
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(["ai_cashier"]);

        var expectedResponse = new AiCashierResponse("أهلاً! أنا سعد", [], "greeting");
        ErrorOr<AiCashierResponse> handlerResult = expectedResponse;
        mediator.Setup(m => m.Send(It.IsAny<AiCashierCommand>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(handlerResult);

        var controller = CreateController(mediator, checker);
        IActionResult actionResult = await controller.Cashier(_branchId, new AiCashierRequest([]), CancellationToken.None);

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(expectedResponse);
        mediator.Verify(m => m.Send(
            It.Is<AiCashierCommand>(c => c.BranchId == _branchId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Cashier_WhenCommandFails_Returns500()
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(["ai_cashier"]);

        ErrorOr<AiCashierResponse> handlerResult = Error.Unexpected("AI.ServiceError", "Claude API unavailable");
        mediator.Setup(m => m.Send(It.IsAny<AiCashierCommand>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(handlerResult);

        var controller = CreateController(mediator, checker);
        IActionResult actionResult = await controller.Cashier(_branchId, new AiCashierRequest([]), CancellationToken.None);

        actionResult.Should().BeOfType<ObjectResult>()
            .Which.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }
}
