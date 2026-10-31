using ErrorOr;
using NexusPOS.CRM.Application.Common;
using NexusPOS.CRM.Domain;
using NexusPOS.CRM.Domain.Entities;
using NexusPOS.CRM.Domain.Repositories;
using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.CRM.Infrastructure.Persistence;

namespace NexusPOS.CRM.Application.Commands.CreateCustomer;

internal sealed class CreateCustomerCommandHandler(
    ICustomerRepository customerRepository,
    CrmDbContext dbContext)
    : ICommandHandler<CreateCustomerCommand, CustomerResponse>
{
    public async Task<ErrorOr<CustomerResponse>> Handle(
        CreateCustomerCommand request,
        CancellationToken cancellationToken)
    {
        // A blank email from the form means none; only a real one has to be unique.
        string? email = Customer.Clean(request.Email);
        if (email is not null)
        {
            bool emailTaken = await customerRepository.ExistsByEmailAsync(
                request.TenantId, email, cancellationToken);

            if (emailTaken)
            {
                return CrmErrors.CustomerEmailTaken;
            }
        }

        // One customer per phone in a store, however the number was typed, so points never split across two records.
        string? phone = Customer.CleanPhone(request.Phone);
        if (phone is not null &&
            await customerRepository.ExistsActiveByPhoneAsync(request.TenantId, phone, null, cancellationToken))
        {
            return CrmErrors.CustomerPhoneTaken;
        }

        Customer customer = Customer.Create(
            request.TenantId, request.Name, email, phone,
            request.Address, request.DateOfBirth, request.Notes, request.MarketingOptIn ?? false);

        customerRepository.Add(customer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CrmMapper.ToResponse(customer);
    }
}
