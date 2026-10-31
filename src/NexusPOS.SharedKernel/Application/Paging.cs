namespace NexusPOS.SharedKernel.Application;

// Query-string paging goes straight into Skip((page - 1) * pageSize): page 0 makes a negative OFFSET
// that PostgreSQL rejects, and an unbounded pageSize loads the whole table.
public static class Paging
{
    public const int MaxPageSize = 200;

    public static int Page(int page) => Math.Max(page, 1);

    public static int Size(int pageSize, int max = MaxPageSize) => Math.Clamp(pageSize, 1, max);
}
