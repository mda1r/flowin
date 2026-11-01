namespace NexusPOS.POS.Domain.ValueObjects;

// An add-on sold with a line ("شوفان", "شوت إضافي") as it was when sold: the catalogue option id, its name and its
// net price on top of the size. Kept on the line so the invoice reads the same after the menu changes.
public sealed record OrderLineModifier(Guid Id, string Name, decimal PriceDelta);
