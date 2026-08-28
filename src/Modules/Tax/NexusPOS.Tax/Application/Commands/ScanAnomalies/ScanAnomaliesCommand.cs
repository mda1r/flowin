using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.Tax.Application.Commands.ScanAnomalies;

public sealed record ScanAnomaliesCommand(Guid PeriodId, Guid TenantId) : ICommand<int>;
