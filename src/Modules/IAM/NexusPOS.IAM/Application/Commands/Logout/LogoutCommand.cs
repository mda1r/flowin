using NexusPOS.SharedKernel.Application.Messaging;

namespace NexusPOS.IAM.Application.Commands.Logout;

public sealed record LogoutCommand(
    string RefreshToken,
    bool LogoutAllDevices = false) : ICommand<LogoutResponse>;

public sealed record LogoutResponse(bool Success);
