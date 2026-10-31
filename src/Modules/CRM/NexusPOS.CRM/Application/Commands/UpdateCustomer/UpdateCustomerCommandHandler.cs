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

        string? email = Customer.Clean(request.Email);
        if (email is not null &&
            !string.Equals(customer.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            bool emailTaken = await customerRepository.ExistsByEmailAsync(
                request.TenantId, email, cancellationToken);

            if (emailTaken)
            {
                return CrmErrors.CustomerEmailTaken;
            }
        }

        // Only a changed number is checked, so editing a customer who already shares a phone from before still saves.
        string? phone = Customer.CleanPhone(request.Phone);
        if (phone is not null &&
            phone != Customer.CleanPhone(customer.Phone) &&
            await customerRepository.ExistsActiveByPhoneAsync(request.TenantId, phone, customer.Id, cancellationToken))
        {
            return CrmErrors.CustomerPhoneTaken;
        }

        customer.UpdateProfile(request.Name, email, phone,
            request.Address, request.DateOfBirth, request.Notes, request.MarketingOptIn);

        customerRepository.Update(customer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CrmMapper.ToResponse(customer);
    }
}
