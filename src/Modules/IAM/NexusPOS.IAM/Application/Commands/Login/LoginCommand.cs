using NexusPOS.IAM.Application.Common;
using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.Login;

public sealed record LoginCommand(
    string Email,
    string Password,
    string? DeviceInfo = null) : ICommand<TokenResponse>;
