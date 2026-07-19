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
        if (request.Email is not null)
        {
            bool emailTaken = await customerRepository.ExistsByEmailAsync(
                request.TenantId, request.Email, cancellationToken);

            if (emailTaken)
            {
                return CrmErrors.CustomerEmailTaken;
            }
        }

        Customer customer = Customer.Create(
            request.TenantId, request.Name, request.Email, request.Phone,
            request.Address, request.DateOfBirth, request.Notes);

        customerRepository.Add(customer);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CrmMapper.ToResponse(customer);
    }
}
