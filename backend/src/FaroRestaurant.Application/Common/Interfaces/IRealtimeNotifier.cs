using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Application.Orders;

namespace FaroRestaurant.Application.Common.Interfaces;

/// <summary>
/// Pushes live events to connected clients (implemented with SignalR in the API layer).
/// </summary>
public interface IRealtimeNotifier
{
    Task OrderCreatedAsync(Guid restaurantId, OrderDto order, CancellationToken cancellationToken = default);
    Task OrderUpdatedAsync(Guid restaurantId, OrderDto order, CancellationToken cancellationToken = default);
    Task NotificationCreatedAsync(Guid restaurantId, NotificationDto notification, CancellationToken cancellationToken = default);
    Task TablesChangedAsync(Guid restaurantId, CancellationToken cancellationToken = default);
}
