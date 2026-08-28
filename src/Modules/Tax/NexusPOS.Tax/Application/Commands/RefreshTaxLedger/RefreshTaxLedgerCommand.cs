using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Tax.Application.Commands.RefreshTaxLedger;

public sealed record RefreshTaxLedgerCommand(Guid PeriodId, Guid TenantId) : ICommand<int>;
