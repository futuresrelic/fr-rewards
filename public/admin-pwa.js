// PWA Admin JavaScript
let selectedFile = null;
let currentTheme = null;
let originalIconImage = null;
let isTransparent = false;

// Theme Presets
const themePresets = [
    {
        name: '🌙 Midnight Purple',
        id: 'midnight-purple',
        colors: {
            primary: '#8b5cf6',
            secondary: '#6366f1',
            success: '#10b981',
            bgDark: '#0f172a',
            bgCard: '#1e293b',
            themeColor: '#8b5cf6'
        }
    },
    {
        name: '🌊 Ocean Blue',
        id: 'ocean-blue',
        colors: {
            primary: '#3b82f6',
            secondary: '#06b6d4',
            success: '#10b981',
            bgDark: '#0c1629',
            bgCard: '#1e293b',
            themeColor: '#3b82f6'
        }
    },
    {
        name: '🌸 Sakura Pink',
        id: 'sakura-pink',
        colors: {
            primary: '#ec4899',
            secondary: '#f472b6',
            success: '#10b981',
            bgDark: '#1a0a14',
            bgCard: '#2d1b24',
            themeColor: '#ec4899'
        }
    },
    {
        name: '🔥 Volcanic Red',
        id: 'volcanic-red',
        colors: {
            primary: '#ef4444',
            secondary: '#f97316',
            success: '#10b981',
            bgDark: '#1a0a0a',
            bgCard: '#2d1a1a',
            themeColor: '#ef4444'
        }
    },
    {
        name: '🌿 Forest Green',
        id: 'forest-green',
        colors: {
            primary: '#10b981',
            secondary: '#14b8a6',
            success: '#22c55e',
            bgDark: '#0a1a14',
            bgCard: '#1a2d24',
            themeColor: '#10b981'
        }
    },
    {
        name: '☀️ Golden Sunset',
        id: 'golden-sunset',
        colors: {
            primary: '#f59e0b',
            secondary: '#eab308',
            success: '#10b981',
            bgDark: '#1a1408',
            bgCard: '#2d2418',
            themeColor: '#f59e0b'
        }
    },
    {
        name: '🌌 Deep Space',
        id: 'deep-space',
        colors: {
            primary: '#6366f1',
            secondary: '#8b5cf6',
            success: '#10b981',
            bgDark: '#000000',
            bgCard: '#0f0f23',
            themeColor: '#6366f1'
        }
    },
    {
        name: '🍊 Citrus Burst',
        id: 'citrus-burst',
        colors: {
            primary: '#fb923c',
            secondary: '#fbbf24',
            success: '#10b981',
            bgDark: '#1a1008',
            bgCard: '#2d2018',
            themeColor: '#fb923c'
        }
    },
    {
        name: '📜 Sepia',
        id: 'sepia',
        colors: {
            primary: '#a0826d',
            secondary: '#8b6f47',
            success: '#7a9d54',
            bgDark: '#1a1612',
            bgCard: '#2d2520',
            themeColor: '#a0826d'
        }
    },
    {
        name: '🏜️ Desert',
        id: 'desert',
        colors: {
            primary: '#d4a574',
            secondary: '#c96d4a',
            success: '#8b9556',
            bgDark: '#1c1510',
            bgCard: '#2e2318',
            themeColor: '#d4a574'
        }
    },
    {
        name: '📷 Vintage',
        id: 'vintage',
        colors: {
            primary: '#b8957a',
            secondary: '#9c6b5f',
            success: '#7a9c7a',
            bgDark: '#15120f',
            bgCard: '#26221d',
            themeColor: '#b8957a'
        }
    },
    {
        name: '🪻 Lavender Fields',
        id: 'lavender',
        colors: {
            primary: '#9d84b7',
            secondary: '#b695c0',
            success: '#88b577',
            bgDark: '#12101a',
            bgCard: '#1f1a2d',
            themeColor: '#9d84b7'
        }
    },
    {
        name: '🪸 Coral Reef',
        id: 'coral-reef',
        colors: {
            primary: '#ff7f6a',
            secondary: '#ffb088',
            success: '#5fc9b8',
            bgDark: '#1a0f0d',
            bgCard: '#2d1e1a',
            themeColor: '#ff7f6a'
        }
    },
    {
        name: '🍂 Autumn Leaves',
        id: 'autumn',
        colors: {
            primary: '#d97532',
            secondary: '#c1554d',
            success: '#7fa650',
            bgDark: '#1a0f08',
            bgCard: '#2d1f14',
            themeColor: '#d97532'
        }
    },
    {
        name: '☕ Coffee & Cream',
        id: 'coffee',
        colors: {
            primary: '#8b6f47',
            secondary: '#a68a64',
            success: '#7fa650',
            bgDark: '#14100a',
            bgCard: '#241f16',
            themeColor: '#8b6f47'
        }
    },
    {
        name: '🌅 Warm Sunset',
        id: 'warm-sunset',
        colors: {
            primary: '#e88d67',
            secondary: '#f4a261',
            success: '#90be6d',
            bgDark: '#1a0e08',
            bgCard: '#2d1d14',
            themeColor: '#e88d67'
        }
    }
];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    renderThemePresets();
    setupColorInputSync();
    setupIconUpload();
});

// Authentication
function checkAuth() {
    const token = sessionStorage.getItem('admin_token');
    if (!token) {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        return;
    }

    // Verify token
    fetch('/api/admin/config', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.ok) {
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            loadCurrentSettings();
        } else {
            sessionStorage.removeItem('admin_token');
            document.getElementById('loginOverlay').style.display = 'flex';
            document.getElementById('mainContent').style.display = 'none';
        }
    })
    .catch(error => {
        console.error('Auth check failed:', error);
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
    });
}

async function adminLogin() {
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            sessionStorage.setItem('admin_token', data.token);
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            loadCurrentSettings();
        } else {
            errorEl.textContent = data.error || 'Invalid password';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        errorEl.textContent = 'Login failed: ' + error.message;
        errorEl.style.display = 'block';
    }
}

function logout() {
    sessionStorage.removeItem('admin_token');
    window.location.reload();
}

// Tab switching
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');

    // Update preview if switching to preview tab
    if (tabName === 'preview') {
        updatePreview();
    }
}

// Load current settings
async function loadCurrentSettings() {
    const token = sessionStorage.getItem('admin_token');

    try {
        // Load manifest settings
        const manifestResponse = await fetch('/api/pwa/manifest');
        const manifest = await manifestResponse.json();

        document.getElementById('appName').value = manifest.name || '';
        document.getElementById('appShortName').value = manifest.short_name || '';
        document.getElementById('appDescription').value = manifest.description || '';
        document.getElementById('appStartUrl').value = manifest.start_url || '/';

        setColorValue('appThemeColor', manifest.theme_color || '#10b981');
        setColorValue('appBgColor', manifest.background_color || '#1a1a2e');

        // Load theme settings
        const themeResponse = await fetch('/api/pwa/theme', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const theme = await themeResponse.json();

        if (theme.colors) {
            currentTheme = theme.colors;
            applyThemeToInputs(theme.colors);
        }

        updatePreview();
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Manifest functions
async function saveManifest() {
    const token = sessionStorage.getItem('admin_token');
    const successEl = document.getElementById('manifestSuccess');
    const errorEl = document.getElementById('manifestError');

    const manifest = {
        name: document.getElementById('appName').value,
        short_name: document.getElementById('appShortName').value,
        description: document.getElementById('appDescription').value,
        start_url: document.getElementById('appStartUrl').value,
        theme_color: document.getElementById('appThemeColorHex').value,
        background_color: document.getElementById('appBgColorHex').value
    };

    try {
        const response = await fetch('/api/pwa/manifest', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(manifest)
        });

        const data = await response.json();

        if (response.ok) {
            successEl.textContent = '✅ App settings saved successfully!';
            successEl.style.display = 'block';
            errorEl.style.display = 'none';
            setTimeout(() => { successEl.style.display = 'none'; }, 5000);
            updatePreview();
        } else {
            errorEl.textContent = '❌ ' + (data.error || 'Failed to save settings');
            errorEl.style.display = 'block';
            successEl.style.display = 'none';
        }
    } catch (error) {
        errorEl.textContent = '❌ Error: ' + error.message;
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
    }
}

// Theme functions
function renderThemePresets() {
    const container = document.getElementById('themePresets');
    container.innerHTML = '';

    themePresets.forEach((theme, index) => {
        const preset = document.createElement('div');
        preset.className = 'theme-preset';
        preset.style.background = theme.colors.bgCard;
        preset.onclick = () => applyThemePreset(theme.id);

        preset.innerHTML = `
            <h3 style="color: ${theme.colors.primary}">${theme.name}</h3>
            <div class="theme-colors">
                <div class="theme-color-swatch" style="background: ${theme.colors.primary}"></div>
                <div class="theme-color-swatch" style="background: ${theme.colors.secondary}"></div>
                <div class="theme-color-swatch" style="background: ${theme.colors.success}"></div>
            </div>
        `;

        container.appendChild(preset);
    });
}

function applyThemePreset(themeId) {
    const theme = themePresets.find(t => t.id === themeId);
    if (!theme) return;

    // Update all theme inputs
    applyThemeToInputs(theme.colors);

    // Visual feedback
    document.querySelectorAll('.theme-preset').forEach(el => {
        el.classList.remove('active');
    });
    event.target.closest('.theme-preset').classList.add('active');

    // Auto-save
    saveTheme();
}

function applyThemeToInputs(colors) {
    setColorValue('themePrimary', colors.primary);
    setColorValue('themeSecondary', colors.secondary);
    setColorValue('themeSuccess', colors.success);
    setColorValue('themeBgDark', colors.bgDark);
    setColorValue('themeBgCard', colors.bgCard);
}

async function saveTheme() {
    const token = sessionStorage.getItem('admin_token');
    const successEl = document.getElementById('themeSuccess');
    const errorEl = document.getElementById('themeError');

    const theme = {
        primary: document.getElementById('themePrimaryHex').value,
        secondary: document.getElementById('themeSecondaryHex').value,
        success: document.getElementById('themeSuccessHex').value,
        bgDark: document.getElementById('themeBgDarkHex').value,
        bgCard: document.getElementById('themeBgCardHex').value
    };

    try {
        const response = await fetch('/api/pwa/theme', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(theme)
        });

        const data = await response.json();

        if (response.ok) {
            successEl.textContent = '✅ Theme saved successfully! Refresh the page to see changes.';
            successEl.style.display = 'block';
            errorEl.style.display = 'none';
            setTimeout(() => { successEl.style.display = 'none'; }, 5000);
            currentTheme = theme;
        } else {
            errorEl.textContent = '❌ ' + (data.error || 'Failed to save theme');
            errorEl.style.display = 'block';
            successEl.style.display = 'none';
        }
    } catch (error) {
        errorEl.textContent = '❌ Error: ' + error.message;
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
    }
}

async function resetTheme() {
    if (!confirm('Reset to default theme? This will reload the page.')) return;

    const token = sessionStorage.getItem('admin_token');

    try {
        const response = await fetch('/api/pwa/theme/reset', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert('✅ Theme reset to default!');
            window.location.reload();
        } else {
            alert('❌ Failed to reset theme');
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

function loadCurrentTheme() {
    if (currentTheme) {
        applyThemeToInputs(currentTheme);
    } else {
        loadCurrentSettings();
    }
}

// Icon upload functions
function setupIconUpload() {
    const uploadArea = document.getElementById('iconUploadArea');
    const fileInput = document.getElementById('iconFileInput');

    uploadArea.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleIconFile(file);
    };

    // Drag and drop
    uploadArea.ondragover = (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    };

    uploadArea.ondragleave = () => {
        uploadArea.classList.remove('dragover');
    };

    uploadArea.ondrop = (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleIconFile(file);
        }
    };
}

function handleIconFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    selectedFile = file;

    // Load image for canvas editing
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            originalIconImage = img;
            initializeIconEditor();
            document.getElementById('iconPreviewSection').style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function uploadIcon() {
    if (!selectedFile) return;

    const token = sessionStorage.getItem('admin_token');
    const successEl = document.getElementById('iconSuccess');
    const errorEl = document.getElementById('iconError');

    try {
        successEl.textContent = '⏳ Preparing icon and generating all sizes...';
        successEl.style.display = 'block';

        // Get the edited icon from canvas
        const canvas = document.getElementById('iconEditorCanvas');

        // Convert canvas to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        // Create FormData with the edited icon
        const formData = new FormData();
        formData.append('icon', blob, 'icon.png');

        successEl.textContent = '⏳ Uploading and generating all icon sizes...';

        const response = await fetch('/api/pwa/upload-icon', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            successEl.textContent = '✅ Icon uploaded and all sizes generated successfully!';
            errorEl.style.display = 'none';
            cancelIconUpload();
            setTimeout(() => {
                successEl.style.display = 'none';
                // Reload to show new icon
                window.location.reload();
            }, 2000);
        } else {
            errorEl.textContent = '❌ ' + (data.error || 'Upload failed');
            errorEl.style.display = 'block';
            successEl.style.display = 'none';
        }
    } catch (error) {
        errorEl.textContent = '❌ Error: ' + error.message;
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
    }
}

function cancelIconUpload() {
    selectedFile = null;
    originalIconImage = null;
    document.getElementById('iconFileInput').value = '';
    document.getElementById('iconPreviewSection').style.display = 'none';
}

// Icon Editor Functions
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function initializeIconEditor() {
    // Reset controls to defaults
    document.getElementById('iconScale').value = 100;
    document.getElementById('iconPadding').value = 0;
    document.getElementById('iconRadius').value = 0;
    document.getElementById('iconBgColor').value = '#8b5cf6';
    document.getElementById('iconBgColorHex').value = '#8b5cf6';
    isTransparent = false;

    // Draw initial icon
    updateIconEditor();
}

function updateIconEditor() {
    if (!originalIconImage) return;

    const canvas = document.getElementById('iconEditorCanvas');
    const ctx = canvas.getContext('2d');

    // Get control values
    const scale = parseInt(document.getElementById('iconScale').value) / 100;
    const padding = parseInt(document.getElementById('iconPadding').value);
    const radius = parseInt(document.getElementById('iconRadius').value);
    const bgColor = document.getElementById('iconBgColor').value;

    // Update value displays
    document.getElementById('scaleValue').textContent = Math.round(scale * 100) + '%';
    document.getElementById('paddingValue').textContent = padding + 'px';
    document.getElementById('radiusValue').textContent = radius + '%';

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (!isTransparent) {
        ctx.fillStyle = bgColor;
        if (radius > 0) {
            // Draw rounded rectangle background
            const cornerRadius = (canvas.width * radius) / 100;
            drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, cornerRadius);
            ctx.fill();
        } else {
            // Draw square background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // Calculate icon dimensions with scale and padding
    const availableSize = canvas.width - (padding * 2);
    const iconSize = availableSize * scale;
    const x = (canvas.width - iconSize) / 2;
    const y = (canvas.height - iconSize) / 2;

    // Draw icon with optional rounded corners
    ctx.save();
    if (radius > 0) {
        // Clip to rounded rectangle for icon
        const cornerRadius = (iconSize * radius) / 100;
        drawRoundedRect(ctx, x, y, iconSize, iconSize, cornerRadius);
        ctx.clip();
    }

    ctx.drawImage(originalIconImage, x, y, iconSize, iconSize);
    ctx.restore();
}

function resetIconEditor() {
    initializeIconEditor();
}

function syncIconBgColor(value) {
    const color = value.trim();
    if (/^#[0-9A-F]{6}$/i.test(color)) {
        document.getElementById('iconBgColor').value = color;
        document.getElementById('iconBgColorHex').value = color;
        isTransparent = false;
        updateIconEditor();
    }
}

function setTransparentBg() {
    isTransparent = true;
    updateIconEditor();
}

// Preview functions
function updatePreview() {
    // Update app info
    const appName = document.getElementById('appName').value || 'Future\'s Relic Rewards';
    const shortName = document.getElementById('appShortName').value || 'FR Rewards';
    const themeColor = document.getElementById('appThemeColorHex').value || '#10b981';
    const bgColor = document.getElementById('appBgColorHex').value || '#1a1a2e';

    document.getElementById('previewName').textContent = appName;
    document.getElementById('previewShortName').textContent = shortName;

    // Update preview colors
    const previewApp = document.getElementById('previewApp');
    const previewContent = document.getElementById('previewContent');
    const previewButton = document.getElementById('previewButton');
    const previewColorDemo = document.getElementById('previewColorDemo');

    previewContent.style.background = bgColor;
    previewColorDemo.style.background = hexToRgba(themeColor, 0.1);
    previewButton.style.background = themeColor;

    // Update icon preview
    document.getElementById('previewIcon').querySelector('img').src = '/icons/icon-192x192.png?' + Date.now();
}

// Utility functions
function setupColorInputSync() {
    const colorPairs = [
        ['appThemeColor', 'appThemeColorHex'],
        ['appBgColor', 'appBgColorHex'],
        ['themePrimary', 'themePrimaryHex'],
        ['themeSecondary', 'themeSecondaryHex'],
        ['themeSuccess', 'themeSuccessHex'],
        ['themeBgDark', 'themeBgDarkHex'],
        ['themeBgCard', 'themeBgCardHex']
    ];

    colorPairs.forEach(([colorId, hexId]) => {
        const colorInput = document.getElementById(colorId);
        const hexInput = document.getElementById(hexId);

        if (colorInput && hexInput) {
            colorInput.addEventListener('input', () => {
                hexInput.value = colorInput.value;
            });

            hexInput.addEventListener('input', () => {
                if (isValidHex(hexInput.value)) {
                    colorInput.value = hexInput.value;
                }
            });
        }
    });
}

function setColorValue(inputId, color) {
    const colorInput = document.getElementById(inputId);
    const hexInput = document.getElementById(inputId + 'Hex');

    if (colorInput) colorInput.value = color;
    if (hexInput) hexInput.value = color;
}

function isValidHex(hex) {
    return /^#[0-9A-F]{6}$/i.test(hex);
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Handle enter key on login
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && document.getElementById('loginOverlay').style.display === 'flex') {
        adminLogin();
    }
});
