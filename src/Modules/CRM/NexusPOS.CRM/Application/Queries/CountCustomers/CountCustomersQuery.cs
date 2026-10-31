using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.CRM.Application.Queries.CountCustomers;

// How many active customers match the same search as the list, so a page of the list can show the total.
public sealed record CountCustomersQuery(Guid TenantId, string? Search = null) : IQuery<int>;
