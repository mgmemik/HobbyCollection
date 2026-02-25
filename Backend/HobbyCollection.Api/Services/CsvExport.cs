using System.Text;

namespace HobbyCollection.Api.Services;

public static class CsvExport
{
    public static byte[] ToUtf8CsvBytesWithBom(IEnumerable<string> headers, IEnumerable<IEnumerable<string?>> rows)
    {
        var sb = new StringBuilder();
        sb.Append('\uFEFF'); // UTF-8 BOM (Excel/TR için)

        WriteRow(sb, headers);
        foreach (var row in rows)
        {
            WriteRow(sb, row);
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static void WriteRow(StringBuilder sb, IEnumerable<string?> values)
    {
        var first = true;
        foreach (var v in values)
        {
            if (!first) sb.Append(',');
            first = false;
            sb.Append(Escape(v));
        }
        sb.Append("\r\n");
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var needsQuotes = value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r');
        if (!needsQuotes) return value;
        return "\"" + value.Replace("\"", "\"\"") + "\"";
    }
}

