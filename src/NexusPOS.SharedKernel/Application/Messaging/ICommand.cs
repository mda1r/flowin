using ErrorOr;
using MediatR;

namespace NexusPOS.SharedKernel.Application.Messaging;

#pragma warning disable CA1040
public interface ICommand : IRequest<ErrorOr<Success>>;

public interface ICommand<TResponse> : IRequest<ErrorOr<TResponse>>;
#pragma warning restore CA1040
