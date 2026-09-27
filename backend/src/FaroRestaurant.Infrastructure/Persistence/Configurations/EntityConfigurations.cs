using FaroRestaurant.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FaroRestaurant.Infrastructure.Persistence.Configurations;

// Money columns use numeric(12,2); enums are stored as strings for readable data and safe reordering.

public class DiningTableConfiguration : IEntityTypeConfiguration<DiningTable>
{
    public void Configure(EntityTypeBuilder<DiningTable> b)
    {
        b.ToTable("tables");
        b.Property(t => t.Location).HasMaxLength(100);
        b.Property(t => t.Status).HasConversion<string>().HasMaxLength(20);
        b.Ignore(t => t.DisplayName);
        b.HasIndex(t => new { t.RestaurantId, t.Number }).IsUnique();
        b.HasIndex(t => new { t.RestaurantId, t.Status });
        b.HasOne(t => t.Restaurant).WithMany().HasForeignKey(t => t.RestaurantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.ToTable("categories");
        b.Property(c => c.Name).HasMaxLength(80).IsRequired();
        b.Property(c => c.Description).HasMaxLength(300);
        b.Property(c => c.Icon).HasMaxLength(16);
        b.HasIndex(c => new { c.RestaurantId, c.Name }).IsUnique();
        b.HasIndex(c => new { c.RestaurantId, c.SortOrder });
        b.HasOne(c => c.Restaurant).WithMany().HasForeignKey(c => c.RestaurantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.ToTable("products");
        b.Property(p => p.Name).HasMaxLength(120).IsRequired();
        b.Property(p => p.Description).HasMaxLength(500);
        b.Property(p => p.ImageUrl).HasMaxLength(500);
        b.Property(p => p.Sku).HasMaxLength(40).IsRequired();
        b.Property(p => p.Price).HasPrecision(12, 2);
        b.HasIndex(p => new { p.RestaurantId, p.Sku }).IsUnique();
        b.HasIndex(p => new { p.RestaurantId, p.CategoryId });
        b.HasIndex(p => new { p.RestaurantId, p.IsAvailable });
        b.HasOne(p => p.Restaurant).WithMany().HasForeignKey(p => p.RestaurantId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(p => p.Category).WithMany(c => c.Products).HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> b)
    {
        b.ToTable("product_images");
        b.Property(i => i.Url).HasMaxLength(500).IsRequired();
        b.HasIndex(i => new { i.ProductId, i.SortOrder });
        b.HasOne(i => i.Product).WithMany(p => p.Images).HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("orders");
        b.Property(o => o.Number).UseIdentityByDefaultColumn().HasIdentityOptions(startValue: 1001);
        b.Property(o => o.CustomerName).HasMaxLength(150);
        b.Property(o => o.Notes).HasMaxLength(500);
        b.Property(o => o.Source).HasConversion<string>().HasMaxLength(20);
        b.Property(o => o.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(o => o.PaymentStatus).HasConversion<string>().HasMaxLength(20);
        b.Property(o => o.Subtotal).HasPrecision(12, 2);
        b.Property(o => o.Discount).HasPrecision(12, 2);
        b.Property(o => o.TaxRate).HasPrecision(5, 2);
        b.Property(o => o.TaxAmount).HasPrecision(12, 2);
        b.Property(o => o.Total).HasPrecision(12, 2);

        b.HasIndex(o => o.Number).IsUnique();
        b.HasIndex(o => new { o.RestaurantId, o.CreatedAt });
        b.HasIndex(o => new { o.RestaurantId, o.Status });
        b.HasIndex(o => o.TableId);
        b.HasIndex(o => o.CustomerId);

        b.HasOne(o => o.Restaurant).WithMany().HasForeignKey(o => o.RestaurantId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(o => o.Table).WithMany(t => t.Orders).HasForeignKey(o => o.TableId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(o => o.Customer).WithMany(c => c.Orders).HasForeignKey(o => o.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.ToTable("order_items");
        b.Property(i => i.ProductName).HasMaxLength(120).IsRequired();
        b.Property(i => i.UnitPrice).HasPrecision(12, 2);
        b.Property(i => i.Notes).HasMaxLength(200);
        b.Ignore(i => i.LineTotal);
        b.HasIndex(i => i.OrderId);
        b.HasIndex(i => i.ProductId);
        b.HasOne(i => i.Order).WithMany(o => o.Items).HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(i => i.Product).WithMany().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> b)
    {
        b.ToTable("customers");
        b.Property(c => c.Name).HasMaxLength(150).IsRequired();
        b.Property(c => c.Phone).HasMaxLength(30);
        b.Property(c => c.Email).HasMaxLength(150);
        b.Property(c => c.Notes).HasMaxLength(500);
        b.HasIndex(c => new { c.RestaurantId, c.Phone }).IsUnique().HasFilter("phone IS NOT NULL");
        b.HasIndex(c => new { c.RestaurantId, c.Email });
        b.HasIndex(c => c.UserId);
        b.HasOne(c => c.Restaurant).WithMany().HasForeignKey(c => c.RestaurantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> b)
    {
        b.ToTable("reservations");
        b.Property(r => r.CustomerName).HasMaxLength(150).IsRequired();
        b.Property(r => r.Phone).HasMaxLength(30).IsRequired();
        b.Property(r => r.Email).HasMaxLength(150);
        b.Property(r => r.Notes).HasMaxLength(500);
        b.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        b.HasIndex(r => new { r.RestaurantId, r.Date });
        b.HasIndex(r => r.TableId);
        b.HasIndex(r => r.CustomerId);
        b.HasOne(r => r.Restaurant).WithMany().HasForeignKey(r => r.RestaurantId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(r => r.Table).WithMany().HasForeignKey(r => r.TableId).OnDelete(DeleteBehavior.SetNull);
        b.HasOne(r => r.Customer).WithMany(c => c.Reservations).HasForeignKey(r => r.CustomerId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class StaffMemberConfiguration : IEntityTypeConfiguration<StaffMember>
{
    public void Configure(EntityTypeBuilder<StaffMember> b)
    {
        b.ToTable("staff");
        b.Property(s => s.FullName).HasMaxLength(150).IsRequired();
        b.Property(s => s.Email).HasMaxLength(150).IsRequired();
        b.Property(s => s.Phone).HasMaxLength(30);
        b.Property(s => s.Role).HasMaxLength(30).IsRequired();
        b.HasIndex(s => s.UserId).IsUnique();
        b.HasIndex(s => new { s.RestaurantId, s.Role });
        b.HasOne(s => s.Restaurant).WithMany().HasForeignKey(s => s.RestaurantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> b)
    {
        b.ToTable("inventory");
        b.Property(i => i.Name).HasMaxLength(120).IsRequired();
        b.Property(i => i.Unit).HasMaxLength(20).IsRequired();
        b.Property(i => i.Supplier).HasMaxLength(150);
        b.Property(i => i.Quantity).HasPrecision(12, 3);
        b.Property(i => i.MinimumQuantity).HasPrecision(12, 3);
        b.Property(i => i.PurchasePrice).HasPrecision(12, 2);
        b.Property(i => i.SellingPrice).HasPrecision(12, 2);
        b.Ignore(i => i.IsLowStock);
        b.HasIndex(i => new { i.RestaurantId, i.Name }).IsUnique();
        b.HasOne(i => i.Restaurant).WithMany().HasForeignKey(i => i.RestaurantId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class InventoryTransactionConfiguration : IEntityTypeConfiguration<InventoryTransaction>
{
    public void Configure(EntityTypeBuilder<InventoryTransaction> b)
    {
        b.ToTable("inventory_transactions");
        b.Property(t => t.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(t => t.QuantityChange).HasPrecision(12, 3);
        b.Property(t => t.QuantityAfter).HasPrecision(12, 3);
        b.Property(t => t.Note).HasMaxLength(200);
        b.HasIndex(t => new { t.InventoryItemId, t.CreatedAt });
        b.HasOne(t => t.InventoryItem).WithMany(i => i.Transactions).HasForeignKey(t => t.InventoryItemId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.ToTable("payments");
        b.Property(p => p.Amount).HasPrecision(12, 2);
        b.Property(p => p.Method).HasConversion<string>().HasMaxLength(20);
        b.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(p => p.Provider).HasMaxLength(40).IsRequired();
        b.Property(p => p.TransactionReference).HasMaxLength(100);
        b.Property(p => p.FailureReason).HasMaxLength(300);
        b.HasIndex(p => new { p.RestaurantId, p.CreatedAt });
        b.HasIndex(p => p.OrderId);
        b.HasOne(p => p.Restaurant).WithMany().HasForeignKey(p => p.RestaurantId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(p => p.Order).WithMany(o => o.Payments).HasForeignKey(p => p.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class OrderPushSubscriptionConfiguration : IEntityTypeConfiguration<OrderPushSubscription>
{
    public void Configure(EntityTypeBuilder<OrderPushSubscription> b)
    {
        b.ToTable("order_push_subscriptions");
        b.Property(s => s.Endpoint).HasMaxLength(1000).IsRequired();
        b.Property(s => s.P256dh).HasMaxLength(200).IsRequired();
        b.Property(s => s.Auth).HasMaxLength(100).IsRequired();
        b.HasIndex(s => new { s.OrderId, s.Endpoint }).IsUnique();
        b.HasOne(s => s.Order).WithMany().HasForeignKey(s => s.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("notifications");
        b.Property(n => n.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(n => n.Title).HasMaxLength(150).IsRequired();
        b.Property(n => n.Message).HasMaxLength(500).IsRequired();
        b.Property(n => n.Link).HasMaxLength(200);
        b.HasIndex(n => new { n.RestaurantId, n.IsRead, n.CreatedAt });
        b.HasOne(n => n.Restaurant).WithMany().HasForeignKey(n => n.RestaurantId).OnDelete(DeleteBehavior.Cascade);
    }
}
