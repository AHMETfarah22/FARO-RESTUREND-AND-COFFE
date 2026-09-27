using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Application.Common.Interfaces;

/// <summary>
/// Sends Web Push notifications to customers' phones about their QR-menu orders
/// (works even when the menu page is closed or the phone is locked).
/// </summary>
public interface ICustomerPushNotifier
{
    /// <summary>VAPID public key the browser needs to subscribe, or null when push is not configured.</summary>
    string? PublicKey { get; }

    Task NotifyOrderStatusAsync(Guid orderId, int orderNumber, string? tableName, OrderStatus status, CancellationToken cancellationToken = default);
}
