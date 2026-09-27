namespace FaroRestaurant.Domain.Common;

/// <summary>
/// Base type for all persisted domain entities.
/// Timestamps are maintained automatically by the persistence layer.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
