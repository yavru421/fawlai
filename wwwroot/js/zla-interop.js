window.zlaInterop = {
    // Scene 3: Draw Wireframe Jig
    drawWireframeJig: function (elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        // SVG wireframe animation logic
        el.innerHTML = `
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M10,90 L50,10 L90,90 Z" fill="none" stroke="#00f0ff" stroke-width="2" stroke-dasharray="300" stroke-dashoffset="300">
                    <animate attributeName="stroke-dashoffset" from="300" to="0" dur="2s" fill="freeze" />
                </path>
                <circle cx="50" cy="50" r="20" fill="none" stroke="#39ff14" stroke-width="1" stroke-dasharray="150" stroke-dashoffset="150">
                    <animate attributeName="stroke-dashoffset" from="150" to="0" dur="1.5s" begin="0.5s" fill="freeze" />
                </circle>
            </svg>
        `;
    },

    // Scene 4: Slider/Drag Logic
    initPourSlider: function (dotNetHelper, elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        let isDragging = false;
        
        el.addEventListener('mousedown', (e) => {
            isDragging = true;
        });
        
        el.addEventListener('touchstart', (e) => {
            isDragging = true;
        }, { passive: true });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        window.addEventListener('touchend', () => {
            isDragging = false;
        });

        const updatePosition = (clientX) => {
            if (!isDragging) return;
            const rect = el.parentElement.getBoundingClientRect();
            let percentage = ((clientX - rect.left) / rect.width) * 100;
            percentage = Math.max(0, Math.min(100, percentage));
            el.style.left = percentage + '%';
            
            // Call back to Blazor
            if (dotNetHelper) {
                dotNetHelper.invokeMethodAsync('UpdatePourState', percentage);
            }
        };

        window.addEventListener('mousemove', (e) => {
            updatePosition(e.clientX);
        });
        
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                updatePosition(e.touches[0].clientX);
            }
        }, { passive: true });
    },

    // Scene 5: Celebration
    triggerConfetti: function (elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        el.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        canvas.width = el.clientWidth;
        canvas.height = el.clientHeight;

        const particles = [];
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.5) * 15 - 5,
                size: Math.random() * 6 + 4,
                color: Math.random() > 0.5 ? '#00f0ff' : (Math.random() > 0.5 ? '#39ff14' : '#ff0055')
            });
        }

        let animationFrame;
        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.3; // gravity
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });
            animationFrame = requestAnimationFrame(render);
        }
        render();

        setTimeout(() => {
            cancelAnimationFrame(animationFrame);
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }, 4000);
    },

    // Scroll snapping helper
    scrollToElement: function (elementId) {
        const el = document.getElementById(elementId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
};
