using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Commands.CreateTaxPeriod;

public sealed record CreateTaxPeriodCommand(
    Guid TenantId,
    DateOnly StartDate,
    DateOnly EndDate,
    string? Notes) : ICommand<TaxPeriodResponse>;
