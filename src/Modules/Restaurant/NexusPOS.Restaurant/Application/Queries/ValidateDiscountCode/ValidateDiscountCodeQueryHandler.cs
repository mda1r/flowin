using ErrorOr;
using NexusPOS.Restaurant.Application.Common;
using NexusPOS.Restaurant.Domain.Entities;
using NexusPOS.Restaurant.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Restaurant.Application.Queries.ValidateDiscountCode;

internal sealed class ValidateDiscountCodeQueryHandler(IDiscountCodeRepository discountCodeRepository)
    : IQueryHandler<ValidateDiscountCodeQuery, ValidateDiscountCodeResponse>
{
    public async Task<ErrorOr<ValidateDiscountCodeResponse>> Handle(
        ValidateDiscountCodeQuery request,
        CancellationToken cancellationToken)
    {
        DiscountCode? code = await discountCodeRepository.FindByCodeAsync(
            request.TenantId, request.Code, cancellationToken);

        if (code is null)
        {
            return new ValidateDiscountCodeResponse(
                Code: request.Code,
                Type: default,
                Value: 0,
                DiscountAmount: 0,
                IsValid: false,
                ErrorMessage: "رمز الخصم غير موجود.");
        }

        ErrorOr<Success> validation = code.Validate(request.OrderAmount);
        if (validation.IsError)
        {
            return new ValidateDiscountCodeResponse(
                Code: code.Code,
                Type: code.Type,
                Value: code.Value,
                DiscountAmount: 0,
                IsValid: false,
                ErrorMessage: validation.FirstError.Description);
        }

        decimal discountAmount = code.ComputeDiscount(request.OrderAmount);

        return new ValidateDiscountCodeResponse(
            Code: code.Code,
            Type: code.Type,
            Value: code.Value,
            DiscountAmount: discountAmount,
            IsValid: true,
            ErrorMessage: null);
    }
}
