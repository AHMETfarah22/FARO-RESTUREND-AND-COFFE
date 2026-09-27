namespace FaroRestaurant.Application.Health;

public interface ISystemHealthService
{
    Task<SystemHealthDto> GetHealthAsync(CancellationToken cancellationToken = default);
}
