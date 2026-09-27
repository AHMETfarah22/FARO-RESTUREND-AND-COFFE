using FaroRestaurant.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Common.Interfaces;

/// <summary>
/// Persistence abstraction used by application services. Each DbSet acts as a repository and
/// SaveChangesAsync as the unit of work, so services never depend on the concrete EF Core context.
/// </summary>
public interface IAppDbContext
{
    DbSet<Restaurant> Restaurants { get; }
    DbSet<DiningTable> Tables { get; }
    DbSet<Category> Categories { get; }
    DbSet<Product> Products { get; }
    DbSet<ProductImage> ProductImages { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<Reservation> Reservations { get; }
    DbSet<Customer> Customers { get; }
    DbSet<StaffMember> Staff { get; }
    DbSet<InventoryItem> InventoryItems { get; }
    DbSet<InventoryTransaction> InventoryTransactions { get; }
    DbSet<Payment> Payments { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<OrderPushSubscription> OrderPushSubscriptions { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>Runs the action in a database transaction (used where stock and orders must change together).</summary>
    Task<T> InTransactionAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken = default);
}
