using FaroRestaurant.Domain.Enums;
using FluentValidation;

namespace FaroRestaurant.Application.Orders;

public sealed record OrderItemDto(Guid Id, Guid? ProductId, string ProductName, decimal UnitPrice, int Quantity, string? Notes, decimal LineTotal);

public sealed record OrderPaymentDto(Guid Id, decimal Amount, PaymentMethod Method, PaymentStatus Status, string? TransactionReference, DateTime CreatedAt);

public sealed record OrderDto(
    Guid Id,
    int Number,
    Guid? TableId,
    string? TableName,
    Guid? CustomerId,
    string? CustomerName,
    OrderSource Source,
    OrderStatus Status,
    PaymentStatus PaymentStatus,
    decimal Subtotal,
    decimal Discount,
    decimal TaxRate,
    decimal TaxAmount,
    decimal Total,
    decimal PaidAmount,
    string? Notes,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? CompletedAt,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<OrderPaymentDto> Payments);

public sealed record OrderItemRequest(Guid ProductId, int Quantity, string? Notes);

public sealed record CreateOrderRequest(
    Guid? TableId,
    Guid? CustomerId,
    string? CustomerName,
    string? Notes,
    decimal Discount,
    IReadOnlyList<OrderItemRequest> Items);

/// <summary>Order placed by a customer from the QR menu (no login).</summary>
public sealed record PublicOrderRequest(string? CustomerName, string? Phone, string? Notes, IReadOnlyList<OrderItemRequest> Items);

public sealed record UpdateOrderRequest(
    Guid? TableId,
    Guid? CustomerId,
    string? CustomerName,
    string? Notes,
    decimal Discount,
    IReadOnlyList<OrderItemRequest> Items);

public sealed record UpdateOrderStatusRequest(OrderStatus Status);

public sealed record OrderQuery(
    IReadOnlyList<OrderStatus>? Statuses,
    DateOnly? From,
    DateOnly? To,
    string? Search,
    Guid? TableId,
    PaymentStatus? PaymentStatus,
    int Page = 1,
    int PageSize = 20);

/// <summary>What the customer sees when tracking an order from the QR menu.</summary>
public sealed record PublicOrderStatusDto(
    Guid Id,
    int Number,
    string? TableName,
    OrderStatus Status,
    decimal Subtotal,
    decimal TaxAmount,
    decimal Discount,
    decimal Total,
    string Currency,
    DateTime CreatedAt,
    IReadOnlyList<OrderItemDto> Items);

/// <summary>Browser PushSubscription as produced by <c>subscription.toJSON()</c>.</summary>
public sealed record PushSubscriptionRequest(string Endpoint, PushSubscriptionKeys Keys);

public sealed record PushSubscriptionKeys(string P256dh, string Auth);

public class PushSubscriptionRequestValidator : AbstractValidator<PushSubscriptionRequest>
{
    public PushSubscriptionRequestValidator()
    {
        RuleFor(x => x.Endpoint).NotEmpty().MaximumLength(1000)
            .Must(e => Uri.TryCreate(e, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)
            .WithMessage("Push endpoint must be an https URL.");
        RuleFor(x => x.Keys).NotNull();
        RuleFor(x => x.Keys.P256dh).NotEmpty().MaximumLength(200).When(x => x.Keys is not null);
        RuleFor(x => x.Keys.Auth).NotEmpty().MaximumLength(100).When(x => x.Keys is not null);
    }
}

public class OrderItemRequestValidator : AbstractValidator<OrderItemRequest>
{
    public OrderItemRequestValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Quantity).InclusiveBetween(1, 99);
        RuleFor(x => x.Notes).MaximumLength(200);
    }
}

public class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    public CreateOrderRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("Add at least one product.");
        RuleFor(x => x.Items.Count).LessThanOrEqualTo(50);
        RuleForEach(x => x.Items).SetValidator(new OrderItemRequestValidator());
        RuleFor(x => x.CustomerName).MaximumLength(150);
        RuleFor(x => x.Notes).MaximumLength(500);
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
    }
}

public class UpdateOrderRequestValidator : AbstractValidator<UpdateOrderRequest>
{
    public UpdateOrderRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("Add at least one product.");
        RuleFor(x => x.Items.Count).LessThanOrEqualTo(50);
        RuleForEach(x => x.Items).SetValidator(new OrderItemRequestValidator());
        RuleFor(x => x.CustomerName).MaximumLength(150);
        RuleFor(x => x.Notes).MaximumLength(500);
        RuleFor(x => x.Discount).GreaterThanOrEqualTo(0);
    }
}

public class PublicOrderRequestValidator : AbstractValidator<PublicOrderRequest>
{
    public PublicOrderRequestValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("Your cart is empty.");
        RuleFor(x => x.Items.Count).LessThanOrEqualTo(30);
        RuleForEach(x => x.Items).SetValidator(new OrderItemRequestValidator());
        RuleFor(x => x.CustomerName).MaximumLength(100);
        RuleFor(x => x.Phone).MaximumLength(30).Matches(@"^[0-9 +()-]*$").WithMessage("Phone number contains invalid characters.");
        RuleFor(x => x.Notes).MaximumLength(300);
    }
}

public class UpdateOrderStatusRequestValidator : AbstractValidator<UpdateOrderStatusRequest>
{
    public UpdateOrderStatusRequestValidator() => RuleFor(x => x.Status).IsInEnum();
}
