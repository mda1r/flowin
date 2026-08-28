using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Tax.Application.Common;

namespace NexusPOS.Tax.Application.Commands.CloseTaxPeriod;

public sealed record CloseTaxPeriodCommand(Guid PeriodId, Guid TenantId) : ICommand<TaxPeriodResponse>;
