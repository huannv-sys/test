/**
 * Core 3D Network Map functionality
 * Provides the base Three.js setup and integration
 */

// Global Three.js variables
let threeContainer, scene, camera, renderer, controls;
let fontLoader, font;

// Animation and update variables 
let animationId = null;
let needsUpdate = true;

/**
 * Initialize 3D network map
 */
function init3DNetworkMap() {
    console.log("Initializing 3D network map core...");
    
    // Get container element
    threeContainer = document.getElementById('network-map-3d');
    
    // Get dimensions
    const width = threeContainer.clientWidth;
    const height = threeContainer.clientHeight;
    
    // Initialize Three.js
    initThreeJS(width, height);
    
    // Load font for text
    loadFont();
    
    // Set up window resize handler
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
    
    console.log("3D network map core initialized");
}

/**
 * Initialize Three.js components
 * @param {number} width - Container width
 * @param {number} height - Container height
 */
function initThreeJS(width, height) {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121212); // Dark background
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 50);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    threeContainer.appendChild(renderer.domElement);
    
    // Create controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = true;
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // Add a helper grid (optional, can be toggled)
    const gridHelper = new THREE.GridHelper(100, 10, 0x555555, 0x333333);
    gridHelper.visible = false; // Hidden by default
    scene.add(gridHelper);
}

/**
 * Load font for 3D text
 */
function loadFont() {
    fontLoader = new THREE.FontLoader();
    
    // Try to load font from server
    fontLoader.load('/static/fonts/helvetiker_regular.typeface.json', function(loadedFont) {
        font = loadedFont;
        console.log("Font loaded successfully");
    }, undefined, function(error) {
        console.error("Error loading font:", error);
        
        // Fallback: try CDN font
        fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function(loadedFont) {
            font = loadedFont;
            console.log("Font loaded from CDN");
        }, undefined, function(error) {
            console.error("Failed to load font from fallback:", error);
        });
    });
}

/**
 * Handle window resize event
 */
function onWindowResize() {
    if (!threeContainer || !camera || !renderer) return;
    
    const width = threeContainer.clientWidth;
    const height = threeContainer.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    
    needsUpdate = true;
}

/**
 * Animation loop
 */
function animate() {
    animationId = requestAnimationFrame(animate);
    
    if (controls) {
        controls.update();
    }
    
    if (needsUpdate && renderer && scene && camera) {
        renderer.render(scene, camera);
        needsUpdate = false;
    }
}

/**
 * Show error message
 */
function showError(message) {
    console.error("3D Network Map Error:", message);
    
    // If toast notification system is available
    if (typeof window.toasts !== 'undefined') {
        window.toasts.showError(message);
    }
}

/**
 * Cleanup function to properly dispose resources
 */
function cleanup() {
    // Stop animation loop
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // Remove event listeners
    window.removeEventListener('resize', onWindowResize);
    
    // Dispose renderer
    if (renderer) {
        renderer.dispose();
        
        // Remove renderer from DOM
        if (threeContainer && renderer.domElement) {
            threeContainer.removeChild(renderer.domElement);
        }
    }
    
    // Clear references
    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    fontLoader = null;
    font = null;
}

// Make core functions available globally
window.init3DNetworkMap = init3DNetworkMap;
window.cleanup3DNetworkMap = cleanup;
