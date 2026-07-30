using ErrorOr;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NexusPOS.Zatca.Application.Commands.SaveZatcaSettings;
using NexusPOS.Zatca.Application.Common;
using NexusPOS.Zatca.Application.Queries.GetZatcaInvoice;
using NexusPOS.Zatca.Application.Queries.GetZatcaSettings;
using NexusPOS.Zatca.Presentation.Requests;

namespace NexusPOS.Zatca.Presentation;

[ApiController]
[Route("api/v1")]
[Produces("application/json")]
[Authorize]
public sealed class ZatcaController(ISender mediator) : ControllerBase
{
    private Guid TenantId => Guid.Parse(User.FindFirstValue("tenant_id") ?? Guid.Empty.ToString());

    /// <summary>جلب فاتورة زاتكا للطلب</summary>
    [HttpGet("branches/{branchId:guid}/orders/{orderId:guid}/zatca-invoice")]
    [ProducesResponseType(typeof(ZatcaInvoiceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInvoice(Guid orderId, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetZatcaInvoiceQuery(orderId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>جلب إعدادات زاتكا للمستأجر</summary>
    [HttpGet("zatca/settings")]
    [ProducesResponseType(typeof(ZatcaSettingsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetZatcaSettingsQuery(TenantId), cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>حفظ إعدادات زاتكا للمستأجر</summary>
    [HttpPut("zatca/settings")]
    [ProducesResponseType(typeof(ZatcaSettingsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveSettings(
        [FromBody] SaveZatcaSettingsRequest request,
        CancellationToken cancellationToken)
    {
        var command = new SaveZatcaSettingsCommand(
            TenantId,
            request.SellerName,
            request.VatRegistrationNumber,
            request.IsPhase2Enabled,
            request.CertificateBase64,
            request.CertificateExpiryDate);

        var result = await mediator.Send(command, cancellationToken);
        return result.Match(Ok, MapErrors);
    }

    /// <summary>تحميل الفاتورة بصيغة XML</summary>
    [HttpGet("branches/{branchId:guid}/orders/{orderId:guid}/zatca-invoice/xml")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadInvoiceXml(Guid orderId, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetZatcaInvoiceQuery(orderId), cancellationToken);
        if (result.IsError)
        {
            return MapErrors(result.Errors);
        }

        ZatcaInvoiceResponse invoice = result.Value;
        byte[] xmlBytes = System.Text.Encoding.UTF8.GetBytes(invoice.XmlContent);
        return File(xmlBytes, "application/xml", $"invoice-{invoice.InvoiceNumber}.xml");
    }

    private IActionResult MapErrors(List<Error> errors)
    {
        if (errors.TrueForAll(e => e.Type == ErrorType.Validation))
        {
            ValidationProblemDetails pd = new();
            foreach (Error error in errors)
            {
                pd.Errors[error.Code] = [error.Description];
            }

            return ValidationProblem(pd);
        }

        Error first = errors[0];
        int statusCode = first.Type switch
        {
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError,
        };

        return Problem(title: first.Code, detail: first.Description, statusCode: statusCode);
    }
}
