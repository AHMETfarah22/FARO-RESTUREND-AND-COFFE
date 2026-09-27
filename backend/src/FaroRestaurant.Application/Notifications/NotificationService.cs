using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Notifications;

public sealed record NotificationDto(Guid Id, NotificationType Type, string Title, string Message, string? Link, bool IsRead, DateTime CreatedAt);

public sealed record NotificationListDto(IReadOnlyList<NotificationDto> Items, int UnreadCount);

public interface INotificationService
{
    Task<NotificationListDto> ListAsync(bool unreadOnly, int take, CancellationToken cancellationToken = default);
    Task MarkReadAsync(Guid id, CancellationToken cancellationToken = default);
    Task MarkAllReadAsync(CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Stores a notification and pushes it to connected staff in real time.</summary>
    Task PublishAsync(Guid restaurantId, NotificationType type, string title, string message, string? link, CancellationToken cancellationToken = default);
}

public class NotificationService(IAppDbContext db, IRestaurantScope scope, IRealtimeNotifier realtime) : INotificationService
{
    public async Task<NotificationListDto> ListAsync(bool unreadOnly, int take, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var query = db.Notifications.AsNoTracking().Where(n => n.RestaurantId == restaurantId);
        var unread = await query.CountAsync(n => !n.IsRead, cancellationToken);
        if (unreadOnly) query = query.Where(n => !n.IsRead);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(Math.Clamp(take, 1, 200))
            .Select(n => new NotificationDto(n.Id, n.Type, n.Title, n.Message, n.Link, n.IsRead, n.CreatedAt))
            .ToListAsync(cancellationToken);

        return new NotificationListDto(items, unread);
    }

    public async Task MarkReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var notification = await FindAsync(id, cancellationToken);
        notification.IsRead = true;
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkAllReadAsync(CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        await db.Notifications
            .Where(n => n.RestaurantId == restaurantId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true), cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        db.Notifications.Remove(await FindAsync(id, cancellationToken));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task PublishAsync(Guid restaurantId, NotificationType type, string title, string message, string? link, CancellationToken cancellationToken = default)
    {
        var notification = new Notification
        {
            RestaurantId = restaurantId,
            Type = type,
            Title = title,
            Message = message,
            Link = link,
        };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync(cancellationToken);

        await realtime.NotificationCreatedAsync(restaurantId,
            new NotificationDto(notification.Id, type, title, message, link, false, notification.CreatedAt), cancellationToken);
    }

    private async Task<Notification> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Notification", id);
    }
}
