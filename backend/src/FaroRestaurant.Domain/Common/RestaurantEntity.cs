using FaroRestaurant.Domain.Entities;

namespace FaroRestaurant.Domain.Common;

/// <summary>Entity that belongs to a single restaurant (tenant).</summary>
public abstract class RestaurantEntity : BaseEntity
{
    public Guid RestaurantId { get; set; }
    public Restaurant? Restaurant { get; set; }
}
