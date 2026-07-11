let targetYCoordinates = [];
let isRendering = false;
let canvasRef = null;
let contextRef = null;
let clickCallback = null;

function renderLoop() {
    if (!isRendering) return;
    window.requestAnimationFrame(renderLoop);

    if (!canvasRef || !contextRef) return;

    contextRef.clearRect(0, 0, canvasRef.width, canvasRef.height);
    contextRef.strokeStyle = '#00FF00';
    contextRef.lineWidth = 4;

    for (let i = 0; i < targetYCoordinates.length; i++) {
        const y = Math.floor(targetYCoordinates[i]);
        contextRef.beginPath();
        contextRef.moveTo(0, y);
        contextRef.lineTo(canvasRef.width, y);
        contextRef.stroke();
    }
}

export function updateCalibrationLines(yArray) {
    targetYCoordinates = yArray || [];
    if (!isRendering) {
        isRendering = true;
        renderLoop();
    }
}

export function registerClickCallback(callback) {
    clickCallback = callback;
}

export function startCamera() {
    // Staged as a hook/trigger if camera setup needs explicit start/restart
    console.log("startCamera triggered via JSImport");
}

/**
 * Initializes the camera stream and overlays a Canvas element on top of it.
 * Designed to separate hardware-facing media capture from application state.
 *
 * @param {string} containerId - The ID of the container element.
 */
export async function initializeMediaOverlay(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return `Container with ID "${containerId}" not found.`;
    }

    // Bind to existing elements to preserve Blazor DOM reference
    const video = container.querySelector("video") || document.getElementById("cameraFeed");
    const canvas = container.querySelector("canvas") || document.getElementById("measureCanvas");

    if (!video || !canvas) {
        return "Required video or canvas elements not found in container.";
    }

    // 1. Configure the video element
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.transform = "scaleX(-1)"; // Mirror video
    video.style.webkitTransform = "scaleX(-1)";
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");

    // 2. Configure the canvas element
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "auto";
    canvas.style.zIndex = "10";
    canvas.style.background = "transparent";

    // Retain canvas and context references
    canvasRef = canvas;
    contextRef = canvas.getContext("2d");

    // 4. Set up resolution & High-DPI coordinate alignment when metadata loads
    video.addEventListener("loadedmetadata", () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    });

    if (video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    // 5. Request the camera stream using user-facing camera (front camera) for mirroring
    const constraints = {
        video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        return null; // indicates success
    } catch (error) {
        console.warn("Front-facing user camera failed, falling back to standard facingMode.", error);
        
        const fallbackConstraints = {
            video: {
                facingMode: "environment"
            },
            audio: false
        };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            video.srcObject = stream;
            return null; // indicates success
        } catch (fallbackError) {
            console.error("Failed to acquire camera stream.", fallbackError);
            return `Camera access failed: ${fallbackError.message || fallbackError.toString()}`;
        }
    }
}
