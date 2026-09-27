using FaroRestaurant.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FaroRestaurant.Infrastructure.Persistence.Configurations;

public class RestaurantConfiguration : IEntityTypeConfiguration<Restaurant>
{
    public void Configure(EntityTypeBuilder<Restaurant> builder)
    {
        builder.ToTable("restaurants");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name).HasMaxLength(150).IsRequired();
        builder.Property(r => r.Slug).HasMaxLength(160).IsRequired();
        builder.Property(r => r.LogoUrl).HasMaxLength(500);
        builder.Property(r => r.CoverImageUrl).HasMaxLength(500);
        builder.Property(r => r.Phone).HasMaxLength(30);
        builder.Property(r => r.Email).HasMaxLength(150);
        builder.Property(r => r.Address).HasMaxLength(300);
        builder.Property(r => r.Description).HasMaxLength(1000);
        builder.Property(r => r.Currency).HasMaxLength(3).IsFixedLength().IsRequired();
        builder.Property(r => r.TaxRate).HasPrecision(5, 2);

        // Operational settings live in a single jsonb column.
        builder.OwnsOne(r => r.Settings, s => s.ToJson("settings"));

        builder.HasIndex(r => r.Slug).IsUnique();
        builder.HasIndex(r => r.IsActive);
    }
}
