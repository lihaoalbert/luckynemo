using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;

namespace LuckyNemo.SetupEngine.UI;

internal static class IconFonts
{
    public static FontFamily SymbolThemeFontFamily =>
        (FontFamily)Application.Current.Resources["SymbolThemeFontFamily"];
}
