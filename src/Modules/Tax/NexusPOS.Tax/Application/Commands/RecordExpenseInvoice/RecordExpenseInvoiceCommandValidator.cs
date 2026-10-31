using FluentValidation;

namespace NexusPOS.Tax.Application.Commands.RecordExpenseInvoice;

internal sealed class RecordExpenseInvoiceCommandValidator : AbstractValidator<RecordExpenseInvoiceCommand>
{
    public RecordExpenseInvoiceCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.SupplierName).NotEmpty().MaximumLength(256);
        RuleFor(x => x.InvoiceNumber).NotEmpty().MaximumLength(100);
        RuleFor(x => x.InvoiceDate).NotEmpty();
        RuleFor(x => x.BaseAmount).GreaterThan(0);
        RuleFor(x => x.TaxAmount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TaxRate).InclusiveBetween(0, 1);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.SupplierVatNumber)
            .Matches(@"^3\d{14}$")
            .When(x => !string.IsNullOrEmpty(x.SupplierVatNumber))
            .WithMessage("الرقم الضريبي للمورد 15 رقماً يبدأ بـ 3");
    }
}
