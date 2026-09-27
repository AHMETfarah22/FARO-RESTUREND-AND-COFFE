using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Common.Models;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Application.Reservations;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Customers;

public sealed record CustomerDto(
    Guid Id,
    string Name,
    string? Phone,
    string? Email,
    string? Notes,
    int OrderCount,
    decimal TotalSpending,
    DateTime? LastOrderAt,
    DateTime CreatedAt);

public sealed record CustomerDetailDto(
    CustomerDto Customer,
    IReadOnlyList<OrderDto> Orders,
    IReadOnlyList<ReservationDto> Reservations);

public sealed record SaveCustomerRequest(string Name, string? Phone, string? Email, string? Notes);

public interface ICustomerService
{
    Task<PagedResult<CustomerDto>> ListAsync(string? search, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<CustomerDetailDto> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken cancellationToken = default);
    Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Orders of the signed-in customer account (Customer role).</summary>
    Task<IReadOnlyList<OrderDto>> GetMyOrdersAsync(CancellationToken cancellationToken = default);
}

public class CustomerService(IAppDbContext db, IRestaurantScope scope, ICurrentUser currentUser) : ICustomerService
{
    public async Task<PagedResult<CustomerDto>> ListAsync(string? search, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var customers = db.Customers.AsNoTracking().Where(c => c.RestaurantId == restaurantId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            customers = customers.Where(c =>
                c.Name.ToLower().Contains(term) || (c.Phone ?? "").ToLower().Contains(term) || (c.Email ?? "").ToLower().Contains(term));
        }

        var ordered = customers
            .OrderByDescending(c => c.Orders
                .Where(o => o.Status != OrderStatus.Cancelled && o.PaymentStatus == PaymentStatus.Paid)
                .Sum(o => (decimal?)o.Total) ?? 0)
            .ThenBy(c => c.Name);

        return await Project(ordered).ToPagedAsync(page, pageSize, cancellationToken);
    }

    public async Task<CustomerDetailDto> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var customer = await Project(db.Customers.Where(c => c.Id == id && c.RestaurantId == restaurantId)).FirstOrDefaultAsync(cancellationToken)
                       ?? throw new NotFoundException("Customer", id);

        var orders = await db.Orders.AsNoTracking()
            .Include(o => o.Items).Include(o => o.Payments).Include(o => o.Table).Include(o => o.Customer).AsSplitQuery()
            .Where(o => o.CustomerId == id)
            .OrderByDescending(o => o.CreatedAt).Take(50)
            .ToListAsync(cancellationToken);

        var reservations = await ReservationService.Project(db.Reservations
                .Where(r => r.CustomerId == id)
                .OrderByDescending(r => r.Date).ThenByDescending(r => r.Time).Take(50))
            .ToListAsync(cancellationToken);

        return new CustomerDetailDto(customer, orders.Select(OrderService.ToDto).ToList(), reservations);
    }

    public async Task<CustomerDto> CreateAsync(SaveCustomerRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        await EnsureUniqueAsync(restaurantId, request, null, cancellationToken);
        var customer = new Customer { RestaurantId = restaurantId };
        Apply(customer, request);
        db.Customers.Add(customer);
        await db.SaveChangesAsync(cancellationToken);
        return (await GetAsync(customer.Id, cancellationToken)).Customer;
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, SaveCustomerRequest request, CancellationToken cancellationToken = default)
    {
        var customer = await FindAsync(id, cancellationToken);
        await EnsureUniqueAsync(customer.RestaurantId, request, id, cancellationToken);
        Apply(customer, request);
        await db.SaveChangesAsync(cancellationToken);
        return (await GetAsync(id, cancellationToken)).Customer;
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var customer = await FindAsync(id, cancellationToken);
        db.Customers.Remove(customer); // orders/reservations keep the name snapshot, CustomerId becomes null
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<OrderDto>> GetMyOrdersAsync(CancellationToken cancellationToken = default)
    {
        var userId = currentUser.UserId ?? throw new ForbiddenException();
        var orders = await db.Orders.AsNoTracking()
            .Include(o => o.Items).Include(o => o.Payments).Include(o => o.Table).Include(o => o.Customer).AsSplitQuery()
            .Where(o => o.Customer!.UserId == userId)
            .OrderByDescending(o => o.CreatedAt).Take(50)
            .ToListAsync(cancellationToken);
        return orders.Select(OrderService.ToDto).ToList();
    }

    private async Task<Customer> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.Customers.FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Customer", id);
    }

    private async Task EnsureUniqueAsync(Guid restaurantId, SaveCustomerRequest request, Guid? excludeId, CancellationToken cancellationToken)
    {
        var phone = request.Phone?.Trim();
        if (!string.IsNullOrEmpty(phone) &&
            await db.Customers.AnyAsync(c => c.RestaurantId == restaurantId && c.Phone == phone && c.Id != excludeId, cancellationToken))
            throw new ConflictException("A customer with this phone number already exists.");
    }

    private static void Apply(Customer c, SaveCustomerRequest request)
    {
        c.Name = request.Name.Trim();
        c.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        c.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant();
        c.Notes = request.Notes;
    }

    private static IQueryable<CustomerDto> Project(IQueryable<Customer> query) =>
        query.Select(c => new CustomerDto(
            c.Id, c.Name, c.Phone, c.Email, c.Notes,
            c.Orders.Count(o => o.Status != OrderStatus.Cancelled),
            c.Orders.Where(o => o.Status != OrderStatus.Cancelled && o.PaymentStatus == PaymentStatus.Paid).Sum(o => (decimal?)o.Total) ?? 0,
            c.Orders.Max(o => (DateTime?)o.CreatedAt),
            c.CreatedAt));
}

public class SaveCustomerRequestValidator : AbstractValidator<SaveCustomerRequest>
{
    public SaveCustomerRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Phone).MaximumLength(30).Matches(@"^[0-9 +()-]*$").WithMessage("Phone number contains invalid characters.");
        RuleFor(x => x.Email).EmailAddress().MaximumLength(150).When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}
