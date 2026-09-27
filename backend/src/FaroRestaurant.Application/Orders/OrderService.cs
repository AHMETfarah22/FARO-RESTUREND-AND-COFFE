using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Common.Models;
using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Orders;

public interface IOrderService
{
    Task<PagedResult<OrderDto>> ListAsync(OrderQuery query, CancellationToken cancellationToken = default);
    Task<OrderDto> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<OrderDto> CreateAsync(CreateOrderRequest request, CancellationToken cancellationToken = default);
    Task<OrderDto> UpdateAsync(Guid id, UpdateOrderRequest request, CancellationToken cancellationToken = default);
    Task<OrderDto> UpdateStatusAsync(Guid id, OrderStatus status, CancellationToken cancellationToken = default);

    /// <summary>Active tickets for the kitchen display plus recently finished ones.</summary>
    Task<IReadOnlyList<OrderDto>> GetKitchenBoardAsync(CancellationToken cancellationToken = default);

    Task<OrderDto> CreatePublicAsync(Guid tableId, PublicOrderRequest request, CancellationToken cancellationToken = default);
    Task<PublicOrderStatusDto> GetPublicStatusAsync(Guid orderId, CancellationToken cancellationToken = default);

    /// <summary>Registers a customer's phone for "order ready" push notifications (QR menu, no login).</summary>
    Task SubscribeToPushAsync(Guid orderId, PushSubscriptionRequest request, CancellationToken cancellationToken = default);

    /// <summary>After a payment: frees the order's table when nothing is left to pay on it.</summary>
    Task SettleTableAsync(Guid orderId, CancellationToken cancellationToken = default);
}

public class OrderService(
    IAppDbContext db,
    IRestaurantScope scope,
    ICurrentUser currentUser,
    IClock clock,
    IRealtimeNotifier realtime,
    INotificationService notifications,
    ICustomerPushNotifier customerPush) : IOrderService
{
    private const int MaxPushSubscriptionsPerOrder = 5;
    public static readonly OrderStatus[] OpenStatuses =
        [OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready, OrderStatus.Served];

    /// <summary>Allowed status workflow. Anything not listed is rejected.</summary>
    private static readonly Dictionary<OrderStatus, OrderStatus[]> Transitions = new()
    {
        [OrderStatus.Pending] = [OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Cancelled],
        [OrderStatus.Confirmed] = [OrderStatus.Preparing, OrderStatus.Cancelled],
        [OrderStatus.Preparing] = [OrderStatus.Ready, OrderStatus.Cancelled],
        [OrderStatus.Ready] = [OrderStatus.Served, OrderStatus.Completed],
        [OrderStatus.Served] = [OrderStatus.Completed],
        [OrderStatus.Completed] = [],
        [OrderStatus.Cancelled] = [],
    };

    public async Task<PagedResult<OrderDto>> ListAsync(OrderQuery query, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var orders = WithDetails().AsNoTracking().Where(o => o.RestaurantId == restaurantId);

        if (query.Statuses is { Count: > 0 } statuses) orders = orders.Where(o => statuses.Contains(o.Status));
        if (query.PaymentStatus is { } paymentStatus) orders = orders.Where(o => o.PaymentStatus == paymentStatus);
        if (query.TableId is { } tableId) orders = orders.Where(o => o.TableId == tableId);
        if (query.From is { } from) orders = orders.Where(o => o.CreatedAt >= clock.StartOfDayUtc(from));
        if (query.To is { } to) orders = orders.Where(o => o.CreatedAt < clock.StartOfDayUtc(to.AddDays(1)));
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().TrimStart('#');
            var term = search.ToLower();
            orders = int.TryParse(search, out var number)
                ? orders.Where(o => o.Number == number || o.Table!.Number == number)
                : orders.Where(o => (o.CustomerName ?? "").ToLower().Contains(term) || (o.Customer!.Name).ToLower().Contains(term));
        }

        var page = await orders.OrderByDescending(o => o.CreatedAt).ToPagedAsync(query.Page, query.PageSize, cancellationToken);
        return new PagedResult<OrderDto>(page.Items.Select(ToDto).ToList(), page.Page, page.PageSize, page.TotalCount);
    }

    public async Task<OrderDto> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        ToDto(await FindAsync(id, tracked: false, cancellationToken));

    public async Task<IReadOnlyList<OrderDto>> GetKitchenBoardAsync(CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var recentSince = clock.UtcNow.AddHours(-3);
        var active = new[] { OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Preparing, OrderStatus.Ready };

        var orders = await WithDetails().AsNoTracking()
            .Where(o => o.RestaurantId == restaurantId &&
                        (active.Contains(o.Status) ||
                         ((o.Status == OrderStatus.Served || o.Status == OrderStatus.Completed) && (o.UpdatedAt ?? o.CreatedAt) >= recentSince)))
            .OrderBy(o => o.CreatedAt)
            .Take(200)
            .ToListAsync(cancellationToken);

        return orders.Select(ToDto).ToList();
    }

    public async Task<OrderDto> CreateAsync(CreateOrderRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var restaurant = await db.Restaurants.AsNoTracking().FirstAsync(r => r.Id == restaurantId, cancellationToken);

        var order = new Order
        {
            RestaurantId = restaurantId,
            Source = OrderSource.Staff,
            Status = OrderStatus.Confirmed, // staff orders are confirmed on entry
            TaxRate = restaurant.TaxRate,
            Discount = request.Discount,
            Notes = request.Notes,
            CreatedByUserId = currentUser.UserId,
        };

        await ApplyTableAndCustomerAsync(order, request.TableId, request.CustomerId, request.CustomerName, cancellationToken);

        var created = await db.InTransactionAsync(async () =>
        {
            await AddItemsAsync(order, request.Items, cancellationToken);
            order.RecalculateTotals();
            db.Orders.Add(order);
            await OccupyTableAsync(order.TableId, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return order;
        }, cancellationToken);

        return await PublishCreatedAsync(created.Id, cancellationToken);
    }

    public async Task<OrderDto> CreatePublicAsync(Guid tableId, PublicOrderRequest request, CancellationToken cancellationToken = default)
    {
        var table = await db.Tables.AsNoTracking().Include(t => t.Restaurant)
                        .FirstOrDefaultAsync(t => t.Id == tableId, cancellationToken)
                    ?? throw new NotFoundException("Table", tableId);
        var restaurant = table.Restaurant!;

        if (!restaurant.IsActive || !restaurant.Settings.QrOrderingEnabled)
            throw new ConflictException("Online ordering is currently unavailable. Please ask a waiter.");
        if (table.Status == TableStatus.Disabled)
            throw new ConflictException("This table is not accepting orders. Please ask a waiter.");

        var order = new Order
        {
            RestaurantId = restaurant.Id,
            TableId = table.Id,
            Source = OrderSource.QrMenu,
            Status = restaurant.Settings.AutoConfirmQrOrders ? OrderStatus.Confirmed : OrderStatus.Pending,
            TaxRate = restaurant.TaxRate,
            Notes = request.Notes,
            CustomerName = string.IsNullOrWhiteSpace(request.CustomerName) ? null : request.CustomerName.Trim(),
        };

        if (!string.IsNullOrWhiteSpace(request.Phone))
        {
            var phone = request.Phone.Trim();
            var customer = await db.Customers.FirstOrDefaultAsync(c => c.RestaurantId == restaurant.Id && c.Phone == phone, cancellationToken);
            if (customer is null)
            {
                customer = new Customer { RestaurantId = restaurant.Id, Name = order.CustomerName ?? "Guest", Phone = phone };
                db.Customers.Add(customer);
            }
            order.Customer = customer;
            order.CustomerName ??= customer.Name;
        }

        var created = await db.InTransactionAsync(async () =>
        {
            await AddItemsAsync(order, request.Items, cancellationToken, publicMenu: true);
            order.RecalculateTotals();
            db.Orders.Add(order);
            await OccupyTableAsync(order.TableId, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
            return order;
        }, cancellationToken);

        return await PublishCreatedAsync(created.Id, cancellationToken);
    }

    public async Task<PublicOrderStatusDto> GetPublicStatusAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Table).Include(o => o.Restaurant)
                        .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken)
                    ?? throw new NotFoundException("Order", orderId);

        return new PublicOrderStatusDto(order.Id, order.Number, order.Table?.DisplayName, order.Status, order.Subtotal,
            order.TaxAmount, order.Discount, order.Total, order.Restaurant?.Currency ?? "TRY", order.CreatedAt,
            order.Items.OrderBy(i => i.CreatedAt).Select(ToItemDto).ToList());
    }

    public async Task SubscribeToPushAsync(Guid orderId, PushSubscriptionRequest request, CancellationToken cancellationToken = default)
    {
        var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken)
                    ?? throw new NotFoundException("Order", orderId);
        if (order.Status is OrderStatus.Completed or OrderStatus.Cancelled) return; // nothing left to announce

        var existing = await db.OrderPushSubscriptions.Where(s => s.OrderId == orderId).ToListAsync(cancellationToken);
        if (existing.Any(s => s.Endpoint == request.Endpoint)) return;
        if (existing.Count >= MaxPushSubscriptionsPerOrder) throw new ConflictException("Too many devices are following this order.");

        db.OrderPushSubscriptions.Add(new OrderPushSubscription
        {
            OrderId = orderId,
            Endpoint = request.Endpoint,
            P256dh = request.Keys.P256dh,
            Auth = request.Keys.Auth,
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<OrderDto> UpdateAsync(Guid id, UpdateOrderRequest request, CancellationToken cancellationToken = default)
    {
        var order = await FindAsync(id, tracked: true, cancellationToken);
        if (order.Status is not (OrderStatus.Pending or OrderStatus.Confirmed))
            throw new ConflictException("Items can only be changed before the kitchen starts preparing the order.");

        var previousTable = order.TableId;
        await ApplyTableAndCustomerAsync(order, request.TableId, request.CustomerId, request.CustomerName, cancellationToken);
        order.Notes = request.Notes;
        order.Discount = request.Discount;

        await db.InTransactionAsync(async () =>
        {
            RestoreStock(order);
            db.OrderItems.RemoveRange(order.Items);
            order.Items.Clear();
            await AddItemsAsync(order, request.Items, cancellationToken);
            order.RecalculateTotals();

            if (previousTable != order.TableId)
            {
                await OccupyTableAsync(order.TableId, cancellationToken);
                await ReleaseTableAsync(previousTable, order.Id, cancellationToken);
            }

            await db.SaveChangesAsync(cancellationToken);
            return true;
        }, cancellationToken);

        return await PublishUpdatedAsync(order.Id, cancellationToken);
    }

    public async Task<OrderDto> UpdateStatusAsync(Guid id, OrderStatus status, CancellationToken cancellationToken = default)
    {
        var order = await FindAsync(id, tracked: true, cancellationToken);
        if (order.Status == status) return ToDto(order);

        if (!Transitions[order.Status].Contains(status))
            throw new ConflictException($"An order cannot move from {order.Status} to {status}.");

        // Separation of duties: the kitchen cooks, the waiter serves, the cashier closes.
        if (!OrderDuties.CanMoveTo(status, currentUser.IsInRole))
            throw new ForbiddenException($"Your role cannot mark orders as {status}.");

        if (status == OrderStatus.Completed && order.PaymentStatus != PaymentStatus.Paid)
            throw new ConflictException("Take payment before completing the order.");

        await db.InTransactionAsync(async () =>
        {
            order.Status = status;
            if (status == OrderStatus.Cancelled)
            {
                RestoreStock(order);
                await ReleaseTableAsync(order.TableId, order.Id, cancellationToken);
            }
            else if (status == OrderStatus.Completed)
            {
                order.CompletedAt = clock.UtcNow;
                await ReleaseTableAsync(order.TableId, order.Id, cancellationToken);
            }
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }, cancellationToken);

        var dto = await PublishUpdatedAsync(order.Id, cancellationToken);
        await customerPush.NotifyOrderStatusAsync(dto.Id, dto.Number, dto.TableName, dto.Status, cancellationToken);
        return dto;
    }

    // ---------------------------------------------------------------- helpers

    private IQueryable<Order> WithDetails() =>
        db.Orders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .Include(o => o.Table)
            .Include(o => o.Customer)
            .AsSplitQuery();

    private async Task<Order> FindAsync(Guid id, bool tracked, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var query = tracked ? WithDetails() : WithDetails().AsNoTracking();
        return await query.FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Order", id);
    }

    private async Task ApplyTableAndCustomerAsync(Order order, Guid? tableId, Guid? customerId, string? customerName, CancellationToken cancellationToken)
    {
        if (tableId is { } tid)
        {
            var table = await db.Tables.FirstOrDefaultAsync(t => t.Id == tid && t.RestaurantId == order.RestaurantId, cancellationToken)
                        ?? throw new NotFoundException("Table", tid);
            if (table.Status == TableStatus.Disabled) throw new ConflictException($"{table.DisplayName} is disabled.");
            order.TableId = table.Id;
        }
        else order.TableId = null;

        if (customerId is { } cid)
        {
            var customer = await db.Customers.FirstOrDefaultAsync(c => c.Id == cid && c.RestaurantId == order.RestaurantId, cancellationToken)
                           ?? throw new NotFoundException("Customer", cid);
            order.CustomerId = customer.Id;
            order.CustomerName = customer.Name;
        }
        else
        {
            order.CustomerId = null;
            order.CustomerName = string.IsNullOrWhiteSpace(customerName) ? null : customerName.Trim();
        }
    }

    /// <summary>Adds line items using current menu prices and reserves tracked stock.</summary>
    private async Task AddItemsAsync(Order order, IReadOnlyList<OrderItemRequest> items, CancellationToken cancellationToken, bool publicMenu = false)
    {
        var ids = items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products
            .Where(p => ids.Contains(p.Id) && p.RestaurantId == order.RestaurantId)
            .ToDictionaryAsync(p => p.Id, cancellationToken);

        foreach (var group in items.GroupBy(i => i.ProductId))
        {
            if (!products.TryGetValue(group.Key, out var product))
                throw new NotFoundException("Product", group.Key);
            if (!product.IsAvailable)
                throw new ConflictException($"{product.Name} is currently unavailable.");

            var requested = group.Sum(i => i.Quantity);
            if (product.Stock is { } stock)
            {
                if (stock < requested)
                    throw new ConflictException(stock == 0
                        ? $"{product.Name} is out of stock."
                        : $"Only {stock} × {product.Name} left.");
                product.Stock = stock - requested;
            }
        }

        foreach (var item in items)
        {
            var product = products[item.ProductId];
            order.Items.Add(new OrderItem
            {
                ProductId = product.Id,
                ProductName = product.Name,
                UnitPrice = product.Price,
                Quantity = item.Quantity,
                Notes = string.IsNullOrWhiteSpace(item.Notes) ? null : item.Notes.Trim(),
            });
        }
    }

    private void RestoreStock(Order order)
    {
        var ids = order.Items.Where(i => i.ProductId.HasValue).Select(i => i.ProductId!.Value).Distinct().ToList();
        var products = db.Products.Where(p => ids.Contains(p.Id) && p.Stock != null).ToList();
        foreach (var product in products)
            product.Stock += order.Items.Where(i => i.ProductId == product.Id).Sum(i => i.Quantity);
    }

    private async Task OccupyTableAsync(Guid? tableId, CancellationToken cancellationToken)
    {
        if (tableId is null) return;
        var table = await db.Tables.FirstAsync(t => t.Id == tableId, cancellationToken);
        if (table.Status is TableStatus.Available or TableStatus.Reserved or TableStatus.Cleaning)
            table.Status = TableStatus.Occupied;
    }

    /// <summary>
    /// Makes the table Available again as soon as nothing is left to pay on it: no other open, unpaid order.
    /// Called when an order is paid, completed, cancelled or moved to another table.
    /// </summary>
    private async Task<bool> ReleaseTableAsync(Guid? tableId, Guid settledOrderId, CancellationToken cancellationToken)
    {
        if (tableId is null) return false;
        var hasUnpaidOpen = await db.Orders.AnyAsync(
            o => o.TableId == tableId && o.Id != settledOrderId && OpenStatuses.Contains(o.Status) && o.PaymentStatus != PaymentStatus.Paid,
            cancellationToken);
        if (hasUnpaidOpen) return false;

        var table = await db.Tables.FirstAsync(t => t.Id == tableId, cancellationToken);
        if (table.Status != TableStatus.Occupied) return false;
        table.Status = TableStatus.Available;
        return true;
    }

    public async Task SettleTableAsync(Guid orderId, CancellationToken cancellationToken = default)
    {
        var order = await FindAsync(orderId, tracked: false, cancellationToken);
        if (order.PaymentStatus != PaymentStatus.Paid || order.TableId is null) return;
        if (!await ReleaseTableAsync(order.TableId, order.Id, cancellationToken)) return;

        await db.SaveChangesAsync(cancellationToken);
        await realtime.TablesChangedAsync(order.RestaurantId, cancellationToken);
    }

    private async Task<OrderDto> PublishCreatedAsync(Guid id, CancellationToken cancellationToken)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Payments)
            .Include(o => o.Table).Include(o => o.Customer).AsSplitQuery()
            .FirstAsync(o => o.Id == id, cancellationToken);
        var dto = ToDto(order);

        await realtime.OrderCreatedAsync(order.RestaurantId, dto, cancellationToken);
        if (order.TableId.HasValue) await realtime.TablesChangedAsync(order.RestaurantId, cancellationToken);

        var where = dto.TableName ?? "Takeaway";
        var summary = string.Join(", ", dto.Items.Select(i => $"{i.Quantity}x {i.ProductName}"));
        await notifications.PublishAsync(order.RestaurantId, NotificationType.NewOrder,
            $"New order #{dto.Number} · {where}", summary, $"/orders/{dto.Id}", cancellationToken);

        return dto;
    }

    private async Task<OrderDto> PublishUpdatedAsync(Guid id, CancellationToken cancellationToken)
    {
        var dto = await GetAsync(id, cancellationToken);
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        await realtime.OrderUpdatedAsync(restaurantId, dto, cancellationToken);
        if (dto.TableId.HasValue) await realtime.TablesChangedAsync(restaurantId, cancellationToken);
        return dto;
    }

    private static OrderItemDto ToItemDto(OrderItem i) =>
        new(i.Id, i.ProductId, i.ProductName, i.UnitPrice, i.Quantity, i.Notes, i.LineTotal);

    public static OrderDto ToDto(Order o) => new(
        o.Id, o.Number, o.TableId, o.Table?.DisplayName, o.CustomerId, o.Customer?.Name ?? o.CustomerName,
        o.Source, o.Status, o.PaymentStatus, o.Subtotal, o.Discount, o.TaxRate, o.TaxAmount, o.Total,
        o.Payments.Where(p => p.Status == PaymentStatus.Paid).Sum(p => p.Amount),
        o.Notes, o.CreatedAt, o.UpdatedAt, o.CompletedAt,
        o.Items.OrderBy(i => i.CreatedAt).Select(ToItemDto).ToList(),
        o.Payments.OrderBy(p => p.CreatedAt)
            .Select(p => new OrderPaymentDto(p.Id, p.Amount, p.Method, p.Status, p.TransactionReference, p.CreatedAt)).ToList());
}
