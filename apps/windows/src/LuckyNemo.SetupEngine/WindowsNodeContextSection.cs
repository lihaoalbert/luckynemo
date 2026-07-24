namespace LuckyNemo.SetupEngine;

internal static class WindowsNodeContextSection
{
    public const string BeginMarker = "<!-- BEGIN LUCKYNEMO WINDOWS NODE CONTEXT: managed by LuckyNemo Windows setup -->";
    public const string EndMarker = "<!-- END LUCKYNEMO WINDOWS NODE CONTEXT -->";

    public const string Payload = """
This WSL gateway may be paired with the LuckyNemo Windows tray node. For Windows desktop, Windows files, screenshots, camera, notifications, browser proxy, or Windows commands, use the `nodes` tool (`status` / `describe`) and target the Windows node instead of assuming the WSL shell can do it.

For Windows shell work, use `exec host=node` / `system.run`; normal gateway exec runs in WSL. If Windows node commands fail, ask the user to check the tray Permissions page: Node mode, System run (or the requested capability), and Exec policy. If settings changed or capabilities look stale, ask the user to reconnect/restart the Windows node or gateway.
""";

    public static string ManagedBlock => $"{BeginMarker}\n{Payload.TrimEnd()}\n{EndMarker}";
}
