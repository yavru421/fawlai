using System;
using System.Runtime.InteropServices.JavaScript;
using System.Threading.Tasks;

namespace FawlAI.Pages;

public static partial class CameraInterop
{
    [JSImport("initializeMediaOverlay", "camera-overlay.js")]
    internal static partial Task<string?> InitializeMediaOverlay(string containerId);

    [JSImport("startCamera", "camera-overlay.js")]
    internal static partial void StartCamera();

    [JSImport("registerClickCallback", "camera-overlay.js")]
    internal static partial void RegisterClickCallback([JSMarshalAs<JSType.Function<JSType.Number>>] Action<int> clickAction);

    [JSImport("updateCalibrationLines", "camera-overlay.js")]
    internal static partial void UpdateCalibrationLines([JSMarshalAs<JSType.Array<JSType.Number>>] int[] yArray);
}

