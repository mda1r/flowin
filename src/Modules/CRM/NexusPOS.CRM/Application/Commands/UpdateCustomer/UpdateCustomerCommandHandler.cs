using ErrorOr;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.CRM.Domain.ValueObjects;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.CRM.Infrastructure.Persistence;

namespace NexusPOS.CRM.Application.Commands.UpdateCustomer;

internal sealed class UpdateCustomerCommandHandler(
    ICustomerRepository customerRepository,
    CrmDbContext dbContext)
    : ICommandHandler<UpdateCustomerCommand, CustomerResponse>
{
    public async Task<ErrorOr<CustomerResponse>> Handle(
        UpdateCustomerCommand request,
        CancellationToken cancellationToken)
    {
        Customer? customer = await customerRepository.FindByIdAsync(
            new CustomerId(request.CustomerId), cancellationToken);

        if (customer is null || customer.TenantId != request.TenantId)
        {
            return CrmErrors.CustomerNotFound;
        }

        if (request.Email is not null &&
            !string.Equals(customer.Email, request.Email, StringComparison.OrdinalIgnoreCase))
        {
            bool emailTaken = await customerRepository.ExistsByEmailAsync(
                request.TenantId, request.Email, cancellationToken);

            if (emailTaken)
            {
                return CrmErrors.CustomerEmailTaken;
            }
        }

        customer.UpdateProfile(request.Name, request.Email, request.Phone,
            request.Address, request.DateOfBirth, request.Notes);

        customerRepository.Update(customer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CrmMapper.ToResponse(customer);
    }
}
