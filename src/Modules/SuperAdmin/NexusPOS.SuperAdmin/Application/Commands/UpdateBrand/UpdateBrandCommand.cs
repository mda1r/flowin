using NexusPOS.SharedKernel.Application.Messaging;
using NexusPOS.SuperAdmin.Application.Common;

namespace NexusPOS.SuperAdmin.Application.Commands.UpdateBrand;

public sealed record UpdateBrandCommand(
    Guid BrandId,
    string NameAr,
    string NameEn,
    string? Notes,
    string? Status,
    Guid ActorId) : ICommand<BrandResponse>;
