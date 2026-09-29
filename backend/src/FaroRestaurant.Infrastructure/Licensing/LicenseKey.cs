using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Win32;

namespace FaroRestaurant.Infrastructure.Licensing;

/// <summary>What a license key grants: one customer, one computer (or "*"), optionally until a date.</summary>
public sealed record LicensePayload(
    [property: JsonPropertyName("v")] int Version,
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("customer")] string Customer,
    [property: JsonPropertyName("machine")] string Machine,
    [property: JsonPropertyName("issued")] DateOnly Issued,
    [property: JsonPropertyName("expires")] DateOnly? Expires);

/// <summary>
/// License keys are "FARO1.&lt;payload&gt;.&lt;signature&gt;" (base64url), signed with ECDSA P-256 by the seller's
/// tools/license/faro-license.mjs. Only the public key is in the application, so keys cannot be forged.
/// </summary>
public static class LicenseKey
{
    private const string Prefix = "FARO1";

    private const string PublicKeyPem = """
        -----BEGIN PUBLIC KEY-----
        MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyDcMUuSsPpfPHZQTtL3b6poRK6tY
        pvbN7eg54HAcJBQxmCkgXrpHSh59HNK32TtHTt78rm3voM1wN0w1UpSdnQ==
        -----END PUBLIC KEY-----
        """;

    /// <summary>Crockford base 32: no I, L, O or U, so codes survive being read out on the phone.</summary>
    private const string Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

    /// <summary>Removes the spaces and line breaks a key picks up when pasted from a message.</summary>
    public static string Normalize(string key) => new(key.Where(c => !char.IsWhiteSpace(c)).ToArray());

    /// <summary>The key's contents when its signature is valid; otherwise null.</summary>
    public static LicensePayload? Read(string key)
    {
        var parts = Normalize(key).Split('.');
        if (parts.Length != 3 || parts[0] != Prefix) return null;

        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportFromPem(PublicKeyPem);
            // The signature covers the encoded payload exactly as written in the key.
            if (!ecdsa.VerifyData(Encoding.ASCII.GetBytes(parts[1]), Base64Url.DecodeFromChars(parts[2]), HashAlgorithmName.SHA256))
                return null;
            return JsonSerializer.Deserialize<LicensePayload>(Base64Url.DecodeFromChars(parts[1]));
        }
        catch (Exception ex) when (ex is FormatException or JsonException or CryptographicException or ArgumentException)
        {
            return null;
        }
    }

    /// <summary>"XXXX-XXXX-XXXX-XXXX": the first 80 bits of SHA-256("FARO|" + machine id). Same formula as the seller's tool.</summary>
    public static string MachineCode(string machineId)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("FARO|" + machineId.Trim().ToLowerInvariant()));
        var code = new StringBuilder(19);
        int value = 0, bits = 0;
        foreach (var b in hash.AsSpan(0, 10))
        {
            value = (value << 8) | b;
            bits += 8;
            while (bits >= 5)
            {
                if (code.Length is 4 or 9 or 14) code.Append('-');
                code.Append(Alphabet[(value >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }
        return code.ToString();
    }

    /// <summary>A stable id of this computer: Windows' MachineGuid, the Linux machine-id, or the host name.</summary>
    public static string CurrentMachineId()
    {
        if (OperatingSystem.IsWindows())
        {
            using var key = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64)
                .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
            if (key?.GetValue("MachineGuid") is string guid && guid.Length > 0) return guid;
        }

        foreach (var file in new[] { "/etc/machine-id", "/var/lib/dbus/machine-id" })
            if (File.Exists(file)) return File.ReadAllText(file);

        return Environment.MachineName;
    }
}
