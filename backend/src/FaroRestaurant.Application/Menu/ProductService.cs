using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Entities;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Menu;

public sealed record ProductDto(
    Guid Id,
    Guid CategoryId,
    string CategoryName,
    string Name,
    string? Description,
    string? ImageUrl,
    decimal Price,
    string Sku,
    int? Stock,
    bool IsAvailable,
    bool IsFeatured,
    int PreparationMinutes,
    IReadOnlyList<string> Images);

public sealed record SaveProductRequest(
    Guid CategoryId,
    string Name,
    string? Description,
    string? ImageUrl,
    decimal Price,
    string Sku,
    int? Stock,
    bool IsAvailable,
    bool IsFeatured,
    int PreparationMinutes,
    IReadOnlyList<string>? Images);

public sealed record ProductQuery(string? Search, Guid? CategoryId, bool? Available);

public interface IProductService
{
    Task<IReadOnlyList<ProductDto>> ListAsync(ProductQuery query, CancellationToken cancellationToken = default);
    Task<ProductDto> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ProductDto> CreateAsync(SaveProductRequest request, CancellationToken cancellationToken = default);
    Task<ProductDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class ProductService(IAppDbContext db, IRestaurantScope scope) : IProductService
{
    public async Task<IReadOnlyList<ProductDto>> ListAsync(ProductQuery query, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var products = db.Products.Where(p => p.RestaurantId == restaurantId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            products = products.Where(p => p.Name.ToLower().Contains(term) || p.Sku.ToLower().Contains(term));
        }
        if (query.CategoryId is { } categoryId) products = products.Where(p => p.CategoryId == categoryId);
        if (query.Available is { } available) products = products.Where(p => p.IsAvailable == available);

        return await Project(products.OrderBy(p => p.Category!.SortOrder).ThenBy(p => p.Name)).ToListAsync(cancellationToken);
    }

    public async Task<ProductDto> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await Project(db.Products.Where(p => p.Id == id && p.RestaurantId == restaurantId)).FirstOrDefaultAsync(cancellationToken)
               ?? throw new NotFoundException("Product", id);
    }

    public async Task<ProductDto> CreateAsync(SaveProductRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        await ValidateReferencesAsync(restaurantId, request, null, cancellationToken);

        var product = new Product { RestaurantId = restaurantId };
        Apply(product, request);
        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(product.Id, cancellationToken);
    }

    public async Task<ProductDto> UpdateAsync(Guid id, SaveProductRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var product = await db.Products.Include(p => p.Images)
                          .FirstOrDefaultAsync(p => p.Id == id && p.RestaurantId == restaurantId, cancellationToken)
                      ?? throw new NotFoundException("Product", id);
        await ValidateReferencesAsync(restaurantId, request, id, cancellationToken);

        Apply(product, request);
        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.RestaurantId == restaurantId, cancellationToken)
                      ?? throw new NotFoundException("Product", id);
        db.Products.Remove(product); // order items keep their name/price snapshot
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task ValidateReferencesAsync(Guid restaurantId, SaveProductRequest request, Guid? excludeId, CancellationToken cancellationToken)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == request.CategoryId && c.RestaurantId == restaurantId, cancellationToken))
            throw new NotFoundException("Category", request.CategoryId);

        var sku = request.Sku.Trim().ToUpperInvariant();
        if (await db.Products.AnyAsync(p => p.RestaurantId == restaurantId && p.Sku == sku && p.Id != excludeId, cancellationToken))
            throw new ConflictException($"SKU '{sku}' is already used by another product.");
    }

    private static void Apply(Product p, SaveProductRequest request)
    {
        p.CategoryId = request.CategoryId;
        p.Name = request.Name.Trim();
        p.Description = request.Description;
        p.ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim();
        p.Price = request.Price;
        p.Sku = request.Sku.Trim().ToUpperInvariant();
        p.Stock = request.Stock;
        p.IsAvailable = request.IsAvailable;
        p.IsFeatured = request.IsFeatured;
        p.PreparationMinutes = request.PreparationMinutes;

        if (request.Images is not null)
        {
            p.Images.Clear();
            var order = 0;
            foreach (var url in request.Images.Where(u => !string.IsNullOrWhiteSpace(u)).Distinct())
                p.Images.Add(new ProductImage { Url = url.Trim(), SortOrder = order++ });
        }
    }

    private static IQueryable<ProductDto> Project(IQueryable<Product> query) =>
        query.Select(p => new ProductDto(
            p.Id, p.CategoryId, p.Category!.Name, p.Name, p.Description, p.ImageUrl, p.Price, p.Sku, p.Stock,
            p.IsAvailable, p.IsFeatured, p.PreparationMinutes,
            p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList()));
}

public class SaveProductRequestValidator : AbstractValidator<SaveProductRequest>
{
    public SaveProductRequestValidator()
    {
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(500);
        RuleFor(x => x.ImageUrl).MaximumLength(500).Must(BeHttpUrl!).When(x => !string.IsNullOrWhiteSpace(x.ImageUrl))
            .WithMessage("Image URL must be an absolute http(s) URL.");
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).LessThan(1_000_000).PrecisionScale(10, 2, true);
        RuleFor(x => x.Sku).NotEmpty().MaximumLength(40).Matches("^[A-Za-z0-9-_]+$")
            .WithMessage("SKU may contain letters, digits, '-' and '_' only.");
        RuleFor(x => x.Stock).GreaterThanOrEqualTo(0).When(x => x.Stock.HasValue);
        RuleFor(x => x.PreparationMinutes).InclusiveBetween(0, 240);
        RuleForEach(x => x.Images).MaximumLength(500).Must(BeHttpUrl).WithMessage("Image URLs must be absolute http(s) URLs.");
    }

    private static bool BeHttpUrl(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}
