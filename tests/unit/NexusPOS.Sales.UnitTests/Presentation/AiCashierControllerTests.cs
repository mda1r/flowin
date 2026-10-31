using ErrorOr;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
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

    private static AiController CreateControllerWithRole(
        Mock<ISender> mediator,
        Mock<ITenantSubscriptionChecker> checker,
        string role)
    {
        AiController controller = CreateController(mediator, checker);
        controller.ControllerContext.HttpContext.User = new ClaimsPrincipal(
            new ClaimsIdentity(
                [new Claim("tenant_id", _tenantId.ToString()), new Claim(ClaimTypes.Role, role)],
                authenticationType: "test"));
        return controller;
    }

    [Theory]
    [InlineData("Owner", true)]
    [InlineData("Manager", true)]
    [InlineData("Cashier", false)]
    public async Task Available_AssistantDependsOnAiFeatureAndRole(string role, bool expectedAssistant)
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(["ai"]);

        var controller = CreateControllerWithRole(mediator, checker, role);
        IActionResult actionResult = await controller.Available(CancellationToken.None);

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(new AiAvailabilityResponse(Assistant: expectedAssistant, Cashier: false));
    }

    [Fact]
    public async Task Available_WithOnlyAiCashierFeature_HidesAssistant()
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(["ai_cashier"]);

        var controller = CreateControllerWithRole(mediator, checker, "Owner");
        IActionResult actionResult = await controller.Available(CancellationToken.None);

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        ok.Value.Should().Be(new AiAvailabilityResponse(Assistant: false, Cashier: true));
    }

    [Theory]
    [InlineData(nameof(AiController.Chat))]
    [InlineData(nameof(AiController.GetInsights))]
    public void FinanceEndpoints_RequireOwnerOrManagerPolicy(string methodName)
    {
        var attributes = typeof(AiController).GetMethod(methodName)!
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>();

        attributes.Should().Contain(a => a.Policy == "OwnerOrManager");
    }

    [Fact]
    public async Task Cashier_ForwardsCartSnapshotToCommand()
    {
        var mediator = new Mock<ISender>();
        var checker = new Mock<ITenantSubscriptionChecker>();
        checker.Setup(c => c.GetFeaturesAsync(_tenantId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(["ai_cashier"]);
        ErrorOr<AiCashierResponse> handlerResult = new AiCashierResponse("تمام", [], "taking_order");
        mediator.Setup(m => m.Send(It.IsAny<AiCashierCommand>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(handlerResult);

        string variantId = Guid.NewGuid().ToString();
        var request = new AiCashierRequest(
            [new AiCashierMessageDto("user", "كم الحساب؟")],
            [new AiCashierCartLineDto(variantId, "لاتيه", 2, 30m)],
            30m);

        var controller = CreateController(mediator, checker);
        await controller.Cashier(_branchId, request, CancellationToken.None);

        mediator.Verify(m => m.Send(
            It.Is<AiCashierCommand>(c =>
                c.Cart != null && c.Cart.Count == 1 && c.Cart[0].VariantId == variantId && c.CartTotal == 30m),
            It.IsAny<CancellationToken>()), Times.Once);
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
