using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Licensing;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace FaroRestaurant.Infrastructure.Licensing;

public class LicenseOptions
{
    public const string SectionName = "License";

    /// <summary>Where the activated key is kept; relative paths are resolved against the application folder.</summary>
    public string FilePath { get; set; } = "license.key";
}

/// <summary>
/// Holds the installed license. The whole API (except /api/license and /api/health) is locked until a key signed
/// for this computer is activated — see LicenseMiddleware.
/// </summary>
public class LicenseService : ILicenseService
{
    private readonly string _path;
    private readonly IClock _clock;
    private readonly ILogger<LicenseService> _logger;
    private readonly Lock _gate = new();
    private LicensePayload? _license;
    private bool _unreadable;

    public LicenseService(IOptions<LicenseOptions> options, IHostEnvironment environment, IClock clock, ILogger<LicenseService> logger)
    {
        _clock = clock;
        _logger = logger;
        _path = Path.GetFullPath(options.Value.FilePath, environment.ContentRootPath);
        MachineCode = LicenseKey.MachineCode(LicenseKey.CurrentMachineId());
        Load();
    }

    public string MachineCode { get; }

    public bool IsActive => StateOf(_license) == LicenseState.Active;

    public LicenseStatusDto GetStatus()
    {
        var license = _license;
        return new LicenseStatusDto(StateOf(license), MachineCode, license?.Customer, license?.Id, license?.Issued, license?.Expires);
    }

    public LicenseStatusDto Activate(string key)
    {
        var license = LicenseKey.Read(key) ?? throw KeyError("This license key is not valid. Copy the whole key and try again.");
        switch (StateOf(license))
        {
            case LicenseState.OtherMachine:
                throw KeyError($"This license key was made for another computer ({license.Machine}). This computer's code is {MachineCode}.");
            case LicenseState.Expired:
                throw KeyError($"This license key expired on {license.Expires:yyyy-MM-dd}.");
        }

        lock (_gate)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            File.WriteAllText(_path, LicenseKey.Normalize(key));
            _license = license;
            _unreadable = false;
        }
        _logger.LogInformation("License {LicenseId} activated for {Customer}", license.Id, license.Customer);
        return GetStatus();
    }

    private void Load()
    {
        if (!File.Exists(_path))
        {
            _logger.LogWarning("No license installed. The portal shows the activation screen; this computer's code is {MachineCode}.", MachineCode);
            return;
        }

        _license = LicenseKey.Read(File.ReadAllText(_path));
        _unreadable = _license is null;
        if (_unreadable) _logger.LogWarning("The license file {Path} is not a valid license key.", _path);
        else _logger.LogInformation("License {LicenseId} for {Customer}: {State}", _license!.Id, _license.Customer, StateOf(_license));
    }

    private LicenseState StateOf(LicensePayload? license) => license switch
    {
        null => _unreadable ? LicenseState.Invalid : LicenseState.Missing,
        _ when license.Machine != "*" && license.Machine != MachineCode => LicenseState.OtherMachine,
        { Expires: { } expires } when _clock.Today > expires => LicenseState.Expired,
        _ => LicenseState.Active,
    };

    private static ValidationException KeyError(string message) =>
        new(new Dictionary<string, string[]> { ["key"] = [message] });
}
