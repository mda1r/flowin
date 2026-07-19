namespace NexusPOS.SharedKernel.Domain.Exceptions;

public class DomainException : Exception
{
    public string Code { get; }

    public DomainException()
        : base("A domain error occurred.")
    {
        Code = "Domain.Error";
    }

    public DomainException(string message)
        : base(message)
    {
        Code = "Domain.Error";
    }

    public DomainException(string code, string message)
        : base(message)
    {
        Code = code;
    }

    public DomainException(string message, Exception innerException)
        : base(message, innerException)
    {
        Code = "Domain.Error";
    }

    public DomainException(string code, string message, Exception innerException)
        : base(message, innerException)
    {
        Code = code;
    }
}
