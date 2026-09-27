using System.Net;
using System.Text.Json;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Enums;
using FaroRestaurant.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using WebPush;

namespace FaroRestaurant.Infrastructure.Notifications;

public class WebPushOptions
{
    public const string SectionName = "WebPush";

    /// <summary>Contact for the push services, e.g. "mailto:info@restaurant.com".</summary>
    public string Subject { get; set; } = "mailto:info@example.com";
    public string PublicKey { get; set; } = string.Empty;
    public string PrivateKey { get; set; } = string.Empty;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(PublicKey) && !string.IsNullOrWhiteSpace(PrivateKey);
}

/// <summary>
/// Web Push (VAPID) sender for customer order updates. Failures never break the staff action that
/// triggered them; subscriptions the push service reports as gone (404/410) are deleted.
/// </summary>
public class WebPushCustomerNotifier(
    AppDbContext db,
    IOptions<WebPushOptions> options,
    ILogger<WebPushCustomerNotifier> logger) : ICustomerPushNotifier
{
    private static readonly WebPushClient Client = new();
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public string? PublicKey => options.Value.IsConfigured ? options.Value.PublicKey : null;

    public async Task NotifyOrderStatusAsync(Guid orderId, int orderNumber, string? tableName, OrderStatus status, CancellationToken cancellationToken = default)
    {
        var message = MessageFor(status, orderNumber, tableName);
        if (message is null || !options.Value.IsConfigured) return;

        var subscriptions = await db.OrderPushSubscriptions.Where(s => s.OrderId == orderId).ToListAsync(cancellationToken);
        if (subscriptions.Count == 0) return;

        var vapid = new VapidDetails(options.Value.Subject, options.Value.PublicKey, options.Value.PrivateKey);
        var payload = JsonSerializer.Serialize(new
        {
            title = message.Value.Title,
            body = message.Value.Body,
            tag = $"order-{orderId}",
            url = "/menu/orders",
            orderId,
            number = orderNumber,
            table = tableName,
            status = status.ToString(),
        }, Json);

        var expired = new List<Guid>();
        foreach (var s in subscriptions)
        {
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(5));
                await Client.SendNotificationAsync(new PushSubscription(s.Endpoint, s.P256dh, s.Auth), payload, vapid, timeout.Token);
            }
            catch (WebPushException ex) when (ex.StatusCode is HttpStatusCode.Gone or HttpStatusCode.NotFound)
            {
                expired.Add(s.Id); // the customer unsubscribed or the browser dropped the subscription
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Web push for order {OrderId} failed", orderId);
            }
        }

        if (expired.Count > 0)
            await db.OrderPushSubscriptions.Where(s => expired.Contains(s.Id)).ExecuteDeleteAsync(cancellationToken);
    }

    private static (string Title, string Body)? MessageFor(OrderStatus status, int number, string? table) => status switch
    {
        OrderStatus.Ready => ("Your order is ready! 🍽️", $"Order #{number}{(table is null ? "" : $" · {table}")} is ready. Enjoy your meal!"),
        OrderStatus.Preparing => ($"Order #{number} is being prepared", "The kitchen has started on your order."),
        OrderStatus.Cancelled => ($"Order #{number} was cancelled", "Please ask a waiter for help."),
        _ => null,
    };
}
