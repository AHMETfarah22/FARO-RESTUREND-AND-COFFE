using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Entities;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Menu;

public sealed record CategoryDto(Guid Id, string Name, string? Description, string? Icon, int SortOrder, bool IsActive, int ProductCount);

public sealed record SaveCategoryRequest(string Name, string? Description, string? Icon, int SortOrder, bool IsActive);

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken cancellationToken = default);
    Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class CategoryService(IAppDbContext db, IRestaurantScope scope) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.Categories
            .Where(c => c.RestaurantId == restaurantId)
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.Description, c.Icon, c.SortOrder, c.IsActive, c.Products.Count))
            .ToListAsync(cancellationToken);
    }

    public async Task<CategoryDto> CreateAsync(SaveCategoryRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        await EnsureUniqueNameAsync(restaurantId, request.Name, null, cancellationToken);
        var category = new Category { RestaurantId = restaurantId };
        Apply(category, request);
        db.Categories.Add(category);
        await db.SaveChangesAsync(cancellationToken);
        return new CategoryDto(category.Id, category.Name, category.Description, category.Icon, category.SortOrder, category.IsActive, 0);
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, SaveCategoryRequest request, CancellationToken cancellationToken = default)
    {
        var category = await FindAsync(id, cancellationToken);
        await EnsureUniqueNameAsync(category.RestaurantId, request.Name, id, cancellationToken);
        Apply(category, request);
        await db.SaveChangesAsync(cancellationToken);
        var count = await db.Products.CountAsync(p => p.CategoryId == id, cancellationToken);
        return new CategoryDto(category.Id, category.Name, category.Description, category.Icon, category.SortOrder, category.IsActive, count);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var category = await FindAsync(id, cancellationToken);
        if (await db.Products.AnyAsync(p => p.CategoryId == id, cancellationToken))
            throw new ConflictException("This category still has products. Move or delete them first.");
        db.Categories.Remove(category);
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Category> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.Categories.FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Category", id);
    }

    private async Task EnsureUniqueNameAsync(Guid restaurantId, string name, Guid? excludeId, CancellationToken cancellationToken)
    {
        var normalized = name.Trim().ToLower();
        if (await db.Categories.AnyAsync(c => c.RestaurantId == restaurantId && c.Name.ToLower() == normalized && c.Id != excludeId, cancellationToken))
            throw new ConflictException($"A category named '{name.Trim()}' already exists.");
    }

    private static void Apply(Category c, SaveCategoryRequest request)
    {
        c.Name = request.Name.Trim();
        c.Description = request.Description;
        c.Icon = request.Icon;
        c.SortOrder = request.SortOrder;
        c.IsActive = request.IsActive;
    }
}

public class SaveCategoryRequestValidator : AbstractValidator<SaveCategoryRequest>
{
    public SaveCategoryRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(80);
        RuleFor(x => x.Description).MaximumLength(300);
        RuleFor(x => x.Icon).MaximumLength(16);
        RuleFor(x => x.SortOrder).InclusiveBetween(0, 10_000);
    }
}
