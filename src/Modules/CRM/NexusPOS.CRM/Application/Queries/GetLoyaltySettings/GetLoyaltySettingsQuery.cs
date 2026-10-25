using NexusPOS.CRM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.GetLoyaltySettings;

public sealed record GetLoyaltySettingsQuery(Guid TenantId) : IQuery<LoyaltySettingsResponse>;
