using LuckyNemo.Shared;

namespace LuckyNemoTray.Services;

internal static class ChatNotificationSpeechText
{
    public static string Resolve(LuckyNemoNotification notification)
    {
        ArgumentNullException.ThrowIfNull(notification);
        return string.IsNullOrEmpty(notification.FullMessage)
            ? notification.Message
            : notification.FullMessage;
    }
}
