using FluentValidation;
using Microsoft.AspNetCore.Mvc.Filters;
using AppValidationException = FaroRestaurant.Application.Common.Exceptions.ValidationException;

namespace FaroRestaurant.Api.Filters;

/// <summary>
/// Runs the FluentValidation validator (if any) for every action argument before the action executes,
/// so controllers and services always receive validated input.
/// </summary>
public class ValidationFilter(IServiceProvider services) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values)
        {
            if (argument is null) continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
            if (services.GetService(validatorType) is not IValidator validator) continue;

            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            if (!result.IsValid)
            {
                throw new AppValidationException(result.Errors
                    .GroupBy(e => JsonName(e.PropertyName))
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray()));
            }
        }

        await next();
    }

    private static string JsonName(string property) =>
        string.IsNullOrEmpty(property) ? property : char.ToLowerInvariant(property[0]) + property[1..];
}
