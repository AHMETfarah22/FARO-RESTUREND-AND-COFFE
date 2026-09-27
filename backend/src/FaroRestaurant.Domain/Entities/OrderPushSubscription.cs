using FaroRestaurant.Domain.Common;

namespace FaroRestaurant.Domain.Entities;

/// <summary>
/// A customer's browser push endpoint for one QR-menu order ("notify me when my order is ready").
/// Removed automatically with the order, or when the push service reports it expired.
/// </summary>
public class OrderPushSubscription : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public string Endpoint { get; set; } = string.Empty;
    public string P256dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
}
