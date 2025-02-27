// DOM Elements
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const audioFileInput = document.getElementById('audio-file');
const fileNameDisplay = document.getElementById('file-name');
const micToggle = document.getElementById('mic-toggle');
const playPauseBtn = document.getElementById('play-pause');
const volumeSlider = document.getElementById('volume');
const visTypeSelect = document.getElementById('vis-type');
const colorThemeSelect = document.getElementById('color-theme');
const sensitivitySlider = document.getElementById('sensitivity');
const saveImageBtn = document.getElementById('save-image');
const loadingOverlay = document.getElementById('loading');
const gallery = document.getElementById('gallery');
const capturesContainer = document.getElementById('captures');

// Audio Context
let audioContext;
let audioSource;
let analyser;
let audioBuffer;
let audioElement;
let dataArray;
let isPlaying = false;
let isMicActive = false;
let animationId;
let mediaStream;

// Visualization settings
let visType = 'bars';
let colorTheme = 'spectrum';
let sensitivity = 1.5;

// Setup canvas dimensions
function setupCanvas() {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// Initialize audio context
function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    // Get the buffer length
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    // Connect the analyser
    if (audioSource) {
        audioSource.disconnect();
    }
    
    return bufferLength;
}

// Load audio file
function loadAudioFile(file) {
    showLoading(true);
    
    // Create file reader
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const audioData = e.target.result;
        
        // Decode audio data
        audioContext.decodeAudioData(audioData, function(buffer) {
            audioBuffer = buffer;
            
            // Create an audio element for playback
            if (audioElement) {
                audioElement.remove();
            }
            
            audioElement = new Audio();
            audioElement.src = URL.createObjectURL(file);
            document.body.appendChild(audioElement);
            
            // Connect audio element to Web Audio API
            audioSource = audioContext.createMediaElementSource(audioElement);
            audioSource.connect(analyser);
            analyser.connect(audioContext.destination);
            
            // Set volume
            audioElement.volume = volumeSlider.value;
            
            // Enable play button
            playPauseBtn.disabled = false;
            saveImageBtn.disabled = false;
            showLoading(false);
        }, function(err) {
            console.error('Error decoding audio data', err);
            showLoading(false);
            alert('Error decoding audio file. Please try another file.');
        });
    };
    
    reader.onerror = function(err) {
        console.error('Error reading file', err);
        showLoading(false);
        alert('Error reading audio file. Please try another file.');
    };
    
    // Read the file as an array buffer
    reader.readAsArrayBuffer(file);
}

// Initialize microphone
async function initMicrophone() {
    try {
        // Get user media
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        // Create media stream source
        audioSource = audioContext.createMediaStreamSource(mediaStream);
        audioSource.connect(analyser);
        
        // Don't connect to destination to avoid feedback
        isMicActive = true;
        micToggle.classList.add('active');
        
        // Start visualization
        cancelAnimationFrame(animationId);
        visualize();
        
        // Enable save button
        saveImageBtn.disabled = false;
        
    } catch (err) {
        console.error('Error accessing microphone', err);
        alert('Error accessing microphone. Please check your microphone permissions.');
        isMicActive = false;
    }
}

// Stop microphone
function stopMicrophone() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        isMicActive = false;
        micToggle.classList.remove('active');
    }
}

// Play/Pause audio
function togglePlayPause() {
    if (audioElement && !isMicActive) {
        if (isPlaying) {
            audioElement.pause();
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i> Play';
            cancelAnimationFrame(animationId);
        } else {
            audioElement.play();
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
            visualize();
        }
        isPlaying = !isPlaying;
    }
}

// Main visualization function
function visualize() {
    // Clear previous animation frame
    cancelAnimationFrame(animationId);
    
    // Get canvas dimensions
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    // Animation function
    function animate() {
        animationId = requestAnimationFrame(animate);
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Get frequency data
        analyser.getByteFrequencyData(dataArray);
        
        // Apply sensitivity
        const adjustedData = Array.from(dataArray).map(value => Math.min(255, value * sensitivity));
        
        // Render visualization based on selected type
        switch (visType) {
            case 'bars':
                drawBars(adjustedData, width, height);
                break;
            case 'circles':
                drawCircles(adjustedData, width, height);
                break;
            case 'particles':
                drawParticles(adjustedData, width, height);
                break;
            default:
                drawBars(adjustedData, width, height);
        }
    }
    
    // Start animation
    animate();
}

// Draw bars visualization
function drawBars(data, width, height) {
    const barWidth = width / (data.length / 4);
    let x = 0;
    
    for (let i = 0; i < data.length / 4; i++) {
        const barHeight = (data[i] / 255) * height;
        
        // Get color based on theme
        const color = getColor(i, data.length / 4, data[i]);
        
        // Draw bar
        ctx.fillStyle = color;
        ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
        
        x += barWidth;
    }
}

// Draw circles visualization
function drawCircles(data, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const minDimension = Math.min(width, height);
    
    // Calculate average of frequency data for base radius
    const avgValue = data.reduce((sum, value) => sum + value, 0) / data.length;
    const baseRadius = (avgValue / 255) * (minDimension / 4);
    
    // Draw circles
    for (let i = 0; i < 5; i++) {
        // Calculate radius based on frequency ranges
        const start = Math.floor(data.length / 5) * i;
        const end = Math.floor(data.length / 5) * (i + 1);
        const rangeData = data.slice(start, end);
        const rangeAvg = rangeData.reduce((sum, value) => sum + value, 0) / rangeData.length;
        
        const radius = baseRadius + (rangeAvg / 255) * (minDimension / 8) * (i + 1);
        
        // Get color based on theme
        const color = getColor(i, 5, rangeAvg);
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'transparent';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 + (rangeAvg / 255) * 5;
        ctx.stroke();
    }
    
    // Draw center circle that pulses with bass
    const bassValue = data.slice(0, 10).reduce((sum, value) => sum + value, 0) / 10;
    const bassRadius = (bassValue / 255) * (minDimension / 10);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, bassRadius, 0, 2 * Math.PI);
    ctx.fillStyle = getColor(0, 1, bassValue);
    ctx.fill();
}

// Draw particles visualization
function drawParticles(data, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Number of particles based on data
    const numParticles = 100;
    
    // Calculate average of frequency data
    const avgValue = data.reduce((sum, value) => sum + value, 0) / data.length;
    const maxRadius = (avgValue / 255) * (Math.min(width, height) / 2);
    
    for (let i = 0; i < numParticles; i++) {
        // Get frequency value for this particle
        const dataIndex = Math.floor(i * (data.length / numParticles));
        const value = data[dataIndex];
        
        // Calculate position
        const angle = (i / numParticles) * Math.PI * 2;
        const radius = (value / 255) * maxRadius;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        // Particle size based on frequency
        const size = 2 + (value / 255) * 8;
        
        // Get color based on theme
        const color = getColor(i, numParticles, value);
        
        // Draw particle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Optional: connect particles with lines
        if (i > 0) {
            const prevDataIndex = Math.floor((i - 1) * (data.length / numParticles));
            const prevValue = data[prevDataIndex];
            const prevAngle = ((i - 1) / numParticles) * Math.PI * 2;
            const prevRadius = (prevValue / 255) * maxRadius;
            const prevX = centerX + Math.cos(prevAngle) * prevRadius;
            const prevY = centerY + Math.sin(prevAngle) * prevRadius;
            
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
}

// Get color based on theme and value
function getColor(index, total, value) {
    switch (colorTheme) {
        case 'spectrum':
            // HSL color spectrum
            const hue = (index / total) * 360;
            return `hsl(${hue}, 80%, ${50 + (value / 255) * 40}%)`;
            
        case 'gradient':
            // Gradient from blue to purple to pink
            const normIndex = index / total;
            if (normIndex < 0.33) {
                return `rgb(0, ${Math.floor(100 + (value / 255) * 155)}, ${Math.floor(200 + (value / 255) * 55)})`;
            } else if (normIndex < 0.66) {
                return `rgb(${Math.floor((normIndex - 0.33) * 3 * 255)}, ${Math.floor(100 + (value / 255) * 50)}, ${Math.floor(200 + (value / 255) * 55)})`;
            } else {
                return `rgb(${Math.floor(200 + (value / 255) * 55)}, ${Math.floor((1 - normIndex) * 3 * 100)}, ${Math.floor(150 + (value / 255) * 105)})`;
            }
            
        case 'monochrome':
            // Cyan monochrome
            const brightness = 40 + (value / 255) * 60;
            return `rgb(${Math.floor(brightness)}, ${Math.floor(brightness + 100)}, ${Math.floor(brightness + 100)})`;
            
        default:
            return `rgb(${Math.floor((value / 255) * 255)}, ${Math.floor((value / 255) * 255)}, 255)`;
    }
}

// Show/hide loading overlay
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// Save current canvas as image
function saveCanvasImage() {
    const dataURL = canvas.toDataURL('image/png');
    
    // Create capture item
    const captureItem = document.createElement('div');
    captureItem.className = 'capture-item';
    
    // Create image
    const img = document.createElement('img');
    img.src = dataURL;
    captureItem.appendChild(img);
    
    // Create download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download';
    downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
    downloadBtn.onclick = function() {
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `audio-visualization-${Date.now()}.png`;
        link.click();
    };
    captureItem.appendChild(downloadBtn);
    
    // Add to gallery
    capturesContainer.appendChild(captureItem);
    gallery.classList.remove('hidden');
}

// Event Listeners
window.addEventListener('load', () => {
    setupCanvas();
    initAudio();
});

window.addEventListener('resize', setupCanvas);

audioFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        fileNameDisplay.textContent = file.name;
        
        // Stop microphone if active
        if (isMicActive) {
            stopMicrophone();
        }
        
        // Stop current playback
        if (isPlaying) {
            togglePlayPause();
        }
        
        // Load new file
        loadAudioFile(file);
    }
});

micToggle.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (isMicActive) {
        stopMicrophone();
        if (audioElement) {
            playPauseBtn.disabled = false;
        }
    } else {
        // Stop current playback
        if (isPlaying) {
            togglePlayPause();
        }
        
        // Initialize microphone
        initMicrophone();
        playPauseBtn.disabled = true;
    }
});

playPauseBtn.addEventListener('click', () => {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    togglePlayPause();
});

volumeSlider.addEventListener('input', (e) => {
    if (audioElement) {
        audioElement.volume = e.target.value;
    }
});

visTypeSelect.addEventListener('change', (e) => {
    visType = e.target.value;
    if (isPlaying || isMicActive) {
        cancelAnimationFrame(animationId);
        visualize();
    }
});

colorThemeSelect.addEventListener('change', (e) => {
    colorTheme = e.target.value;
});

sensitivitySlider.addEventListener('input', (e) => {
    sensitivity = parseFloat(e.target.value);
});

saveImageBtn.addEventListener('click', saveCanvasImage);