using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Domain.Constants;
using Microsoft.AspNetCore.SignalR;

namespace FaroRestaurant.Api.Realtime;

/// <summary>
/// Real-time channel. Signed-in staff join their restaurant group and receive order, table and
/// notification events. Anonymous QR-menu customers may only follow a single order by its id.
/// </summary>
public class RestaurantHub(IRestaurantScope scope) : Hub
{
    public const string Path = "/hubs/restaurant";

    public static string RestaurantGroup(Guid restaurantId) => $"restaurant:{restaurantId}";
    public static string OrderGroup(Guid orderId) => $"order:{orderId}";

    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (user?.Identity?.IsAuthenticated == true && Roles.All.Where(r => r != Roles.Customer).Any(user.IsInRole))
        {
            var restaurantId = await scope.GetRestaurantIdAsync(Context.ConnectionAborted);
            await Groups.AddToGroupAsync(Context.ConnectionId, RestaurantGroup(restaurantId));
        }
        await base.OnConnectedAsync();
    }

    /// <summary>Lets a customer follow the status of the order they just placed.</summary>
    public Task TrackOrder(Guid orderId) => Groups.AddToGroupAsync(Context.ConnectionId, OrderGroup(orderId));
}

public class SignalRNotifier(IHubContext<RestaurantHub> hub) : IRealtimeNotifier
{
    public async Task OrderCreatedAsync(Guid restaurantId, OrderDto order, CancellationToken cancellationToken = default)
    {
        await hub.Clients.Group(RestaurantHub.RestaurantGroup(restaurantId)).SendAsync("orderCreated", order, cancellationToken);
        await hub.Clients.Group(RestaurantHub.OrderGroup(order.Id)).SendAsync("orderStatus", new { order.Id, order.Status }, cancellationToken);
    }

    public async Task OrderUpdatedAsync(Guid restaurantId, OrderDto order, CancellationToken cancellationToken = default)
    {
        await hub.Clients.Group(RestaurantHub.RestaurantGroup(restaurantId)).SendAsync("orderUpdated", order, cancellationToken);
        await hub.Clients.Group(RestaurantHub.OrderGroup(order.Id)).SendAsync("orderStatus", new { order.Id, order.Status }, cancellationToken);
    }

    public Task NotificationCreatedAsync(Guid restaurantId, NotificationDto notification, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(RestaurantHub.RestaurantGroup(restaurantId)).SendAsync("notification", notification, cancellationToken);

    public Task TablesChangedAsync(Guid restaurantId, CancellationToken cancellationToken = default) =>
        hub.Clients.Group(RestaurantHub.RestaurantGroup(restaurantId)).SendAsync("tablesChanged", cancellationToken);
}
