using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.Zatca.Application.Common;

namespace NexusPOS.Zatca.Application.Queries.GetZatcaSettings;

public sealed record GetZatcaSettingsQuery(Guid TenantId) : IQuery<ZatcaSettingsResponse>;
