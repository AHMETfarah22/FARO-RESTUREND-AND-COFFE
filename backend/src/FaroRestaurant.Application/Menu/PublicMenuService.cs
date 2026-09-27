using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Menu;

public sealed record PublicMenuProductDto(
    Guid Id, string Name, string? Description, string? ImageUrl, decimal Price, bool IsFeatured, bool InStock, int PreparationMinutes);

public sealed record PublicMenuCategoryDto(Guid Id, string Name, string? Icon, IReadOnlyList<PublicMenuProductDto> Products);

public sealed record PublicMenuDto(
    string RestaurantName,
    string? LogoUrl,
    string? CoverImageUrl,
    string? Description,
    string Currency,
    decimal TaxRate,
    string OpeningTime,
    string ClosingTime,
    Guid TableId,
    string TableName,
    bool OrderingEnabled,
    IReadOnlyList<PublicMenuCategoryDto> Categories);

public interface IPublicMenuService
{
    Task<PublicMenuDto> GetForTableAsync(Guid tableId, CancellationToken cancellationToken = default);
}

/// <summary>Anonymous QR menu: only active categories and available products are exposed.</summary>
public class PublicMenuService(IAppDbContext db) : IPublicMenuService
{
    public async Task<PublicMenuDto> GetForTableAsync(Guid tableId, CancellationToken cancellationToken = default)
    {
        var table = await db.Tables.AsNoTracking().Include(t => t.Restaurant)
                        .FirstOrDefaultAsync(t => t.Id == tableId, cancellationToken)
                    ?? throw new NotFoundException("Table", tableId);
        var restaurant = table.Restaurant!;
        if (!restaurant.IsActive) throw new NotFoundException("Table", tableId);

        var categories = await db.Categories.AsNoTracking()
            .Where(c => c.RestaurantId == restaurant.Id && c.IsActive)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new PublicMenuCategoryDto(
                c.Id, c.Name, c.Icon,
                c.Products.Where(p => p.IsAvailable)
                    .OrderByDescending(p => p.IsFeatured).ThenBy(p => p.Name)
                    .Select(p => new PublicMenuProductDto(
                        p.Id, p.Name, p.Description, p.ImageUrl, p.Price, p.IsFeatured, p.Stock == null || p.Stock > 0, p.PreparationMinutes))
                    .ToList()))
            .ToListAsync(cancellationToken);

        return new PublicMenuDto(
            restaurant.Name, restaurant.LogoUrl, restaurant.CoverImageUrl, restaurant.Description, restaurant.Currency, restaurant.TaxRate,
            restaurant.OpeningTime.ToString("HH:mm"), restaurant.ClosingTime.ToString("HH:mm"),
            table.Id, table.DisplayName,
            restaurant.Settings.QrOrderingEnabled && table.Status != TableStatus.Disabled,
            categories.Where(c => c.Products.Count > 0).ToList());
    }
}
