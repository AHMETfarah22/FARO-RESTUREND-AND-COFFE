using FaroRestaurant.Domain.Common;

namespace FaroRestaurant.Domain.Entities;

public class Category : RestaurantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    /// <summary>Emoji or short icon key shown on the QR menu.</summary>
    public string? Icon { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Product> Products { get; set; } = [];
}

public class Product : RestaurantEntity
{
    public Guid CategoryId { get; set; }
    public Category? Category { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
    public string Sku { get; set; } = string.Empty;

    /// <summary>Portions in stock. Null = stock is not tracked for this product.</summary>
    public int? Stock { get; set; }

    public bool IsAvailable { get; set; } = true;
    public bool IsFeatured { get; set; }
    public int PreparationMinutes { get; set; }

    public ICollection<ProductImage> Images { get; set; } = [];
}

public class ProductImage : BaseEntity
{
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public string Url { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}
