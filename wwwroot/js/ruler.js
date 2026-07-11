// StyleCut Hairstyle & Haircut Engine
let activeWig = {
    styleId: "bob",
    x: window.innerWidth / 2,
    y: window.innerHeight / 2 - 50,
    width: 280,
    height: 300,
    rotation: 0, // In radians
    color: "#ff3b30",
};

let currentMode = "Fit"; // Fit, Cut, Dye
let isMouseDown = false;
let isDragging = false;
let isRotatingScaling = false;

let dragStartX = 0;
let dragStartY = 0;
let wigStartX = 0;
let wigStartY = 0;
let startDist = 0;
let startAngle = 0;
let startWidth = 0;
let startHeight = 0;
let startRotation = 0;

let csharpSetStateCallback = null;

// The haircut canvas context mask path
// We use a separate canvas to record all trims/cuts
let cutCanvas = null;
let cutCtx = null;

export async function bindInterop() {
    console.log("StyleCut: successfully bound interop.");
}

export function saveRatio(ratio) {}
export function loadRatio() { return 1.0; }
export function resetRuler() {
    if (cutCtx && cutCanvas) {
        cutCtx.clearRect(0, 0, cutCanvas.width, cutCanvas.height);
    }
    activeWig.x = window.innerWidth / 2;
    activeWig.y = window.innerHeight / 2 - 50;
    activeWig.width = 280;
    activeWig.height = 300;
    activeWig.rotation = 0;
}

export function setCalibrationType(styleId) {
    activeWig.styleId = styleId;
    console.log("Hairstyle updated to: ", styleId);
}

// Interop updates from C#
export function setWigColor(colorHex) {
    activeWig.color = colorHex;
}

export function setInteractionMode(mode) {
    currentMode = mode;
    console.log("Mode updated to: ", mode);
}

export function triggerSnapshot() {
    const mainCanvas = document.getElementById('measureCanvas');
    const video = document.getElementById('cameraFeed');
    if (!mainCanvas || !video) return;

    // Create custom offscreen combination to print video + canvas together
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = mainCanvas.width;
    captureCanvas.height = mainCanvas.height;
    const captureCtx = captureCanvas.getContext('2d');

    // Draw video (mirrored)
    captureCtx.save();
    captureCtx.translate(captureCanvas.width, 0);
    captureCtx.scale(-1, 1);
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    captureCtx.restore();

    // Draw canvas layer on top
    captureCtx.drawImage(mainCanvas, 0, 0);

    // Save as download
    const link = document.createElement('a');
    link.download = `stylecut_${Date.now()}.png`;
    link.href = captureCanvas.toDataURL('image/png');
    link.click();

    if (navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
    }
}

// Vector paths for hairstyles relative to center (0, 0)
function drawWigPath(ctx, styleId, w, h) {
    ctx.beginPath();
    if (styleId === "bob") {
        // Classic Bob cut
        ctx.moveTo(-w * 0.45, -h * 0.2);
        ctx.bezierCurveTo(-w * 0.5, -h * 0.65, w * 0.5, -h * 0.65, w * 0.45, -h * 0.2);
        ctx.bezierCurveTo(w * 0.52, h * 0.1, w * 0.45, h * 0.45, w * 0.35, h * 0.5);
        ctx.bezierCurveTo(w * 0.25, h * 0.52, w * 0.2, h * 0.2, 0, h * 0.15); // Bang line back curve
        ctx.bezierCurveTo(-w * 0.2, h * 0.2, -w * 0.25, h * 0.52, -w * 0.35, h * 0.5);
        ctx.bezierCurveTo(-w * 0.45, h * 0.45, -w * 0.52, h * 0.1, -w * 0.45, -h * 0.2);
        ctx.closePath();

        // Forehead bangs details
        ctx.moveTo(-w * 0.35, -h * 0.15);
        ctx.bezierCurveTo(-w * 0.2, -h * 0.05, 0, -h * 0.1, w * 0.35, -h * 0.15);
        ctx.bezierCurveTo(w * 0.3, -h * 0.28, -w * 0.3, -h * 0.28, -w * 0.35, -h * 0.15);
    } else if (styleId === "afro") {
        // High textured afro
        const steps = 18;
        const radius = w * 0.48;
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const nextAngle = ((i + 0.5) / steps) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius - h * 0.1;
            const xNext = Math.cos(nextAngle) * (radius + 15);
            const yNext = Math.sin(nextAngle) * (radius + 15) - h * 0.1;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.quadraticCurveTo(xNext, yNext, x, y);
            }
        }
        ctx.closePath();
    } else if (styleId === "spiky") {
        // Spiky punk style
        ctx.moveTo(-w * 0.4, 0);
        ctx.lineTo(-w * 0.42, -h * 0.15);
        ctx.lineTo(-w * 0.3, -h * 0.1);
        ctx.lineTo(-w * 0.35, -h * 0.3);
        ctx.lineTo(-w * 0.2, -h * 0.2);
        ctx.lineTo(-w * 0.15, -h * 0.42);
        ctx.lineTo(0, -h * 0.3);
        ctx.lineTo(w * 0.15, -h * 0.42);
        ctx.lineTo(w * 0.2, -h * 0.2);
        ctx.lineTo(w * 0.35, -h * 0.3);
        ctx.lineTo(w * 0.3, -h * 0.1);
        ctx.lineTo(w * 0.42, -h * 0.15);
        ctx.lineTo(w * 0.4, 0);
        ctx.bezierCurveTo(w * 0.35, h * 0.3, -w * 0.35, h * 0.3, -w * 0.4, 0);
        ctx.closePath();
    } else if (styleId === "braids") {
        // Long braided hair
        ctx.moveTo(-w * 0.4, -h * 0.3);
        ctx.bezierCurveTo(-w * 0.45, -h * 0.6, w * 0.45, -h * 0.6, w * 0.4, -h * 0.3);
        ctx.bezierCurveTo(w * 0.48, 0, w * 0.42, h * 0.4, w * 0.32, h * 0.7); // Right side
        ctx.lineTo(w * 0.22, h * 0.7);
        ctx.bezierCurveTo(w * 0.3, h * 0.3, w * 0.25, 0, 0, -h * 0.05); // Inner face line
        ctx.bezierCurveTo(-w * 0.25, 0, -w * 0.3, h * 0.3, -w * 0.22, h * 0.7);
        ctx.lineTo(-w * 0.32, h * 0.7); // Left side
        ctx.bezierCurveTo(-w * 0.42, h * 0.4, -w * 0.48, 0, -w * 0.4, -h * 0.3);
        ctx.closePath();
    } else {
        // Failsafe/Custom
        ctx.arc(0, -h * 0.1, w * 0.45, 0, Math.PI, true);
        ctx.closePath();
    }
}

export function initCanvas() {
    const canvas = document.getElementById('measureCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Create offscreen overlay for trimming scissors cuts
    cutCanvas = document.createElement('canvas');
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        cutCanvas.width = canvas.width;
        cutCanvas.height = canvas.height;
        cutCtx = cutCanvas.getContext('2d');
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function getDistance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    function getAngle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    }

    // Since front-video is mirrored CSS transform: scaleX(-1), 
    // the user clicks on canvas. Because canvas pointerEvents are on top,
    // coordinates match screen pixel space. We don't need to flip coordinates
    // unless comparing raw video coordinates. Touch interactions directly line up with canvas space.
    function handleDown(x, y, touches) {
        isMouseDown = true;

        if (currentMode === "Fit") {
            if (touches && touches.length >= 2) {
                // Two-finger rotate & scale
                isRotatingScaling = true;
                startDist = getDistance(touches[0].clientX, touches[0].clientY, touches[1].clientX, touches[1].clientY);
                startAngle = getAngle(touches[0].clientX, touches[0].clientY, touches[1].clientX, touches[1].clientY);
                startWidth = activeWig.width;
                startHeight = activeWig.height;
                startRotation = activeWig.rotation;
                return;
            }

            // Check if clicking near the scale/rotate handle (drawn above the wig)
            const handleX = activeWig.x + Math.sin(activeWig.rotation) * (activeWig.height * 0.6);
            const handleY = activeWig.y - Math.cos(activeWig.rotation) * (activeWig.height * 0.6);
            if (getDistance(x, y, handleX, handleY) < 30) {
                isRotatingScaling = true;
                startDist = getDistance(x, y, activeWig.x, activeWig.y);
                startAngle = getAngle(activeWig.x, activeWig.y, x, y);
                startWidth = activeWig.width;
                startHeight = activeWig.height;
                startRotation = activeWig.rotation;
                return;
            }

            // Check if dragging wig center
            if (getDistance(x, y, activeWig.x, activeWig.y) < activeWig.width * 0.45) {
                isDragging = true;
                dragStartX = x;
                dragStartY = y;
                wigStartX = activeWig.x;
                wigStartY = activeWig.y;
            }
        } else if (currentMode === "Cut" || currentMode === "Dye") {
            // Cut or paint line directly
            if (cutCtx) {
                cutCtx.beginPath();
                cutCtx.moveTo(x, y);
            }
        }
    }

    function handleMove(x, y, touches) {
        if (!isMouseDown) return;

        if (currentMode === "Fit") {
            if (isRotatingScaling && touches && touches.length >= 2) {
                const curDist = getDistance(touches[0].clientX, touches[0].clientY, touches[1].clientX, touches[1].clientY);
                const curAngle = getAngle(touches[0].clientX, touches[0].clientY, touches[1].clientX, touches[1].clientY);
                
                const factor = curDist / startDist;
                activeWig.width = Math.max(100, Math.min(600, startWidth * factor));
                activeWig.height = Math.max(100, Math.min(600, startHeight * factor));
                activeWig.rotation = startRotation + (curAngle - startAngle);
                return;
            }

            if (isRotatingScaling) {
                const curDist = getDistance(x, y, activeWig.x, activeWig.y);
                const curAngle = getAngle(activeWig.x, activeWig.y, x, y);
                const factor = curDist / startDist;
                activeWig.width = Math.max(100, Math.min(600, startWidth * factor));
                activeWig.height = Math.max(100, Math.min(600, startHeight * factor));
                activeWig.rotation = startRotation + (curAngle - startAngle);
                return;
            }

            if (isDragging) {
                activeWig.x = wigStartX + (x - dragStartX);
                activeWig.y = wigStartY + (y - dragStartY);
            }
        } else if (currentMode === "Cut") {
            // Scissors mask trimming
            if (cutCtx) {
                cutCtx.globalCompositeOperation = 'source-over';
                cutCtx.strokeStyle = 'rgba(0,0,0,1)';
                cutCtx.lineWidth = 28;
                cutCtx.lineCap = 'round';
                cutCtx.lineJoin = 'round';
                cutCtx.lineTo(x, y);
                cutCtx.stroke();
            }
        } else if (currentMode === "Dye") {
            // Paint spray lines onto cutCanvas using a dye destination
            if (cutCtx) {
                cutCtx.globalCompositeOperation = 'source-over';
                // Paint dye colors in a special composite, 
                // for simplicity we will just save the spray color lines directly inside cutCanvas overlay
                cutCtx.strokeStyle = activeWig.color;
                cutCtx.lineWidth = 14;
                cutCtx.lineCap = 'round';
                cutCtx.lineTo(x, y);
                cutCtx.stroke();
            }
        }
    }

    function handleUp() {
        isMouseDown = false;
        isDragging = false;
        isRotatingScaling = false;
    }

    // Touch Event Hookups
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleDown(touch.clientX, touch.clientY, e.touches);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY, e.touches);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleUp();
    }, { passive: false });

    // Mouse Event Hookups
    canvas.addEventListener('mousedown', (e) => {
        handleDown(e.clientX, e.clientY, null);
    });
    canvas.addEventListener('mousemove', (e) => {
        handleMove(e.clientX, e.clientY, null);
    });
    canvas.addEventListener('mouseup', () => {
        handleUp();
    });

    // Main animation 60FPS loop
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Save context state
        ctx.save();

        // 1. Draw Hairstyle layer, rotated and translated
        ctx.translate(activeWig.x, activeWig.y);
        ctx.rotate(activeWig.rotation);

        // Create the hair path
        drawWigPath(ctx, activeWig.styleId, activeWig.width, activeWig.height);

        // Configure style filling
        ctx.fillStyle = activeWig.color;
        ctx.fill();

        // Soft visual stroke for details
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();

        // 2. Apply cutting mask
        // Any cut lines (which we draw in black on cutCanvas) are subtracted from the main view
        if (cutCanvas) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(cutCanvas, 0, 0);
            ctx.restore();
        }

        // 3. Draw adjustments helper in "Fit" mode
        if (currentMode === "Fit") {
            ctx.save();
            ctx.translate(activeWig.x, activeWig.y);
            ctx.rotate(activeWig.rotation);

            // Draw bounding guide circle
            ctx.strokeStyle = 'rgba(0,122,255,0.4)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, activeWig.width * 0.48, 0, Math.PI * 2);
            ctx.stroke();

            // Draw alignment helper knob (above head)
            const handleDist = activeWig.height * 0.6;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -handleDist);
            ctx.strokeStyle = '#007aff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Adjusting Handle
            ctx.beginPath();
            ctx.arc(0, -handleDist, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 4;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.fill();
            ctx.strokeStyle = '#007aff';
            ctx.lineWidth = 3.5;
            ctx.stroke();

            ctx.restore();
        }

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
