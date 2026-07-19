using ErrorOr;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.CRM.Infrastructure.Persistence;

namespace NexusPOS.CRM.Application.Commands.AddLoyaltyPoints;

internal sealed class AddLoyaltyPointsCommandHandler(
    ICustomerRepository customerRepository,
    CrmDbContext dbContext)
    : ICommandHandler<AddLoyaltyPointsCommand, CustomerResponse>
{
    public async Task<ErrorOr<CustomerResponse>> Handle(
        AddLoyaltyPointsCommand request,
        CancellationToken cancellationToken)
    {
        Customer? customer = await customerRepository.FindByIdAsync(
            new CustomerId(request.CustomerId), cancellationToken);

        if (customer is null || customer.TenantId != request.TenantId)
        {
            return CrmErrors.CustomerNotFound;
        }

        ErrorOr<Success> result = customer.AddLoyaltyPoints(request.Points);
        if (result.IsError)
        {
            return result.Errors;
        }

        customerRepository.Update(customer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CrmMapper.ToResponse(customer);
    }
}
