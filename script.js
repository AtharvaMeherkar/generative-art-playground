// --- 1. SCRIPT SETUP AND ELEMENT SELECTION ---
const canvas = document.getElementById("gan-canvas");
const slidersContainer = document.getElementById("sliders-container");
const randomizeBtn = document.getElementById("randomize-btn");
const generateBtn = document.getElementById("generate-btn");
const downloadBtn = document.getElementById("download-btn");

// --- 2. CONFIGURATION ---
const LATENT_DIM = 100; // The number of dimensions in our latent space vector.
const NUM_SLIDERS = 12; // The number of sliders to display for manipulation.

let latentVector = tf.randomNormal([1, LATENT_DIM]); // Our starting point, a random tensor.

// --- 3. UI SETUP AND INTERACTIVITY ---
function setupUI() {
  createSliders();
  updateSliders(latentVector);
  randomizeBtn.addEventListener("click", handleRandomize);
  generateBtn.addEventListener("click", generateAndDrawImage);
  downloadBtn.addEventListener("click", handleDownload);
  downloadBtn.disabled = true; // Disabled until an image is generated
}

function createSliders() {
  slidersContainer.innerHTML = ""; // Clear the placeholder text.
  for (let i = 0; i < NUM_SLIDERS; i++) {
    const sliderWrapper = document.createElement("div");
    const label = document.createElement("label");
    label.innerText = `Dimension ${i + 1}`;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "-2";
    slider.max = "2";
    slider.step = "0.01";
    slider.dataset.index = i;
    slider.addEventListener("input", handleSliderChange);
    sliderWrapper.appendChild(label);
    sliderWrapper.appendChild(slider);
    slidersContainer.appendChild(sliderWrapper);
  }
}

// --- 4. EVENT HANDLERS ---
async function handleRandomize() {
  latentVector.dispose(); // Dispose the old tensor to free memory
  latentVector = tf.randomNormal([1, LATENT_DIM]);
  updateSliders(latentVector);
  await generateAndDrawImage();
}

function handleSliderChange(event) {
  const slider = event.target;
  const index = parseInt(slider.dataset.index);
  const value = parseFloat(slider.value);
  const vectorData = latentVector.dataSync();
  vectorData[index] = value;
  latentVector.dispose();
  latentVector = tf.tensor(vectorData, [1, LATENT_DIM]);
}

function handleDownload() {
  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "generative-art.png";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- 5. CORE IMAGE GENERATION LOGIC ---
async function generateAndDrawImage() {
  generateBtn.disabled = true;
  generateBtn.innerText = "Generating...";

  // Use a timeout to allow the UI to update before the heavy computation
  await new Promise((resolve) => setTimeout(resolve, 10));

  const outputTensor = generatePatternFromVector(latentVector);
  await tf.browser.toPixels(outputTensor, canvas);

  outputTensor.dispose();

  generateBtn.disabled = false;
  generateBtn.innerText = "Generate";
  downloadBtn.disabled = false; // Enable download button after first generation
}

// --- 6. ADVANCED PATTERN GENERATION FUNCTION ---
function generatePatternFromVector(vector) {
  return tf.tidy(() => {
    const [height, width] = [768, 768]; // Match new canvas dimensions
    const vectorData = vector.dataSync();

    // Sliders 1-3: Control base colors
    const rBase = (vectorData[0] + 2) / 4;
    const gBase = (vectorData[1] + 2) / 4;
    const bBase = (vectorData[2] + 2) / 4;

    // Sliders 4-7: Control frequencies and amplitudes for warping
    const freq1 = (vectorData[3] + 2) * 4;
    const amp1 = (vectorData[4] + 2) / 4;
    const freq2 = (vectorData[5] + 2) * 4;
    const amp2 = (vectorData[6] + 2) / 4;

    // Sliders 8-9: Control frequencies for final color patterns
    const colorFreq1 = (vectorData[7] + 2) * 5;
    const colorFreq2 = (vectorData[8] + 2) * 5;

    // Sliders 10-12: Control zoom, twist, and rotation
    const zoom = (vectorData[9] + 2.5) / 2;
    const twist = vectorData[10] * 2.5;
    const rotAngle = vectorData[11] * Math.PI;

    // Create initial coordinate grid
    let [x, y] = tf.meshgrid(
      tf.linspace(-1, 1, width),
      tf.linspace(-1, 1, height)
    );

    // --- Geometric Transformations ---
    x = x.mul(zoom);
    y = y.mul(zoom);

    const sinAngle = Math.sin(rotAngle);
    const cosAngle = Math.cos(rotAngle);
    const x_rot = x.mul(cosAngle).sub(y.mul(sinAngle));
    const y_rot = x.mul(sinAngle).add(y.mul(cosAngle));

    const d = tf.sqrt(x_rot.square().add(y_rot.square()));
    const x_twisted = x_rot.add(y_rot.mul(d).mul(twist));
    const y_twisted = y_rot.sub(x_rot.mul(d).mul(twist));

    // --- Domain Warping ---
    const warpX = tf.sin(y_twisted.mul(freq1)).mul(amp1);
    const warpY = tf.cos(x_twisted.mul(freq2)).mul(amp2);

    const warpedX = x_twisted.add(warpX);
    const warpedY = y_twisted.add(warpY);

    // Generate final color channels using the warped coordinates
    const rChannel = tf.sin(warpedX.mul(colorFreq1)).add(rBase).div(2);
    const gChannel = tf.cos(warpedY.mul(colorFreq2)).add(gBase).div(2);
    const bChannel = tf
      .sin(warpedX.add(warpedY).mul(colorFreq1))
      .add(bBase)
      .div(2);

    return tf.stack([rChannel, gChannel, bChannel], 2).clipByValue(0, 1);
  });
}

function updateSliders(vector) {
  const vectorData = vector.dataSync();
  const sliders = document.querySelectorAll(
    '#sliders-container input[type="range"]'
  );
  sliders.forEach((slider, i) => {
    slider.value = vectorData[i];
  });
}

// --- 7. RUN THE APPLICATION ---
const style = document.createElement("style");
style.innerHTML = `
    .slider-wrapper { margin-bottom: 12px; }
    .slider-wrapper label { display: block; font-size: 0.8rem; margin-bottom: 5px; color: #ccc; }
    input[type="range"] { width: 100%; cursor: pointer; -webkit-appearance: none; appearance: none; background: transparent; }
    input[type="range"]::-webkit-slider-runnable-track { height: 4px; background: #444; border-radius: 2px; }
    input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; margin-top: -6px; width: 16px; height: 16px; background: var(--primary-color); border-radius: 50%; }
`;
document.head.appendChild(style);

function initializeApp() {
  console.log('Application ready. Click "Generate" to start.');
  setupUI();
}

initializeApp();
