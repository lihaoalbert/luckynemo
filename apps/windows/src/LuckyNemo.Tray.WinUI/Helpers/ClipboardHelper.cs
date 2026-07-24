using Windows.ApplicationModel.DataTransfer;

namespace LuckyNemoTray.Helpers;

internal static class ClipboardHelper
{
    public static void CopyText(string text, bool flush = false)
    {
        var dataPackage = new DataPackage();
        dataPackage.SetText(text);
        Clipboard.SetContent(dataPackage);

        if (flush)
            Clipboard.Flush();
    }
}
