/**
 * Brack Web Host Controller
 * Real-time Web Audio API + WASM Engine Runner with Oscilloscope
 */

let audioCtx = null;
let scriptNode = null;
let wasmExports = null;
let isPlaying = false;

// Module IDs in rack
let clockId, seqId, vcoId, vcfId, adsrId, vcaId, delayId, outId;

// Buffer pointers in WASM
const BLOCK_SIZE = 128;
const outLeftPtr = 1024;
const outRightPtr = 1024 + BLOCK_SIZE * 4;

async function initWasm() {
    const response = await fetch('../roms/brack.wasm');
    const bytes = await response.arrayBuffer();
    const wasm = await WebAssembly.instantiate(bytes, { env: {} });
    wasmExports = wasm.instance.exports;

    // Initialize Engine
    wasmExports.brack_init(48000.0);
    wasmExports.brack_set_bpm(130.0);

    // Create Eurorack modules
    clockId = wasmExports.brack_module_create(11); // CLOCK
    seqId   = wasmExports.brack_module_create(6);  // SEQ
    vcoId   = wasmExports.brack_module_create(1);  // VCO
    vcfId   = wasmExports.brack_module_create(2);  // VCF
    adsrId  = wasmExports.brack_module_create(4);  // ADSR
    vcaId   = wasmExports.brack_module_create(3);  // VCA
    delayId = wasmExports.brack_module_create(8);  // DELAY
    outId   = wasmExports.brack_module_create(12); // OUT

    // Configure Defaults
    wasmExports.brack_module_set_param(clockId, 0, 130.0);

    // 8-step Acid Notes (C2, C3, Eb2, F2, G2, Bb2, C2, Eb3)
    const notes = [0.0, 1.0, 3/12, 5/12, 7/12, 10/12, 0.0, 15/12];
    for (let s = 0; s < 8; s++) {
        wasmExports.brack_module_set_param(seqId, s, notes[s]);
        wasmExports.brack_module_set_param(seqId, 8 + s, 1.0);
    }
    wasmExports.brack_module_set_param(seqId, 16, 8.0);

    wasmExports.brack_module_set_param(vcoId, 3, 65.406); // C2
    wasmExports.brack_module_set_param(vcoId, 6, 0.0);    // Saw wave

    wasmExports.brack_module_set_param(adsrId, 0, 0.005);
    wasmExports.brack_module_set_param(adsrId, 1, 0.160);
    wasmExports.brack_module_set_param(adsrId, 2, 0.150);
    wasmExports.brack_module_set_param(adsrId, 3, 0.080);

    wasmExports.brack_module_set_param(vcfId, 0, 450.0);
    wasmExports.brack_module_set_param(vcfId, 1, 0.78);
    wasmExports.brack_module_set_param(vcfId, 2, 1.8);

    wasmExports.brack_module_set_param(vcaId, 0, 0.0);
    wasmExports.brack_module_set_param(vcaId, 1, 1.0);

    wasmExports.brack_module_set_param(delayId, 0, 0.230);
    wasmExports.brack_module_set_param(delayId, 1, 0.45);
    wasmExports.brack_module_set_param(delayId, 2, 0.40);
    wasmExports.brack_module_set_param(delayId, 3, 0.30);

    wasmExports.brack_module_set_param(outId, 0, 0.85);

    // Patch Cables
    wasmExports.brack_patch_connect(clockId, 0, seqId, 0, 1.0);  // Clock -> Seq
    wasmExports.brack_patch_connect(seqId, 0, vcoId, 0, 1.0);    // Seq CV -> VCO
    wasmExports.brack_patch_connect(seqId, 1, adsrId, 0, 1.0);   // Seq Gate -> ADSR
    wasmExports.brack_patch_connect(vcoId, 1, vcfId, 0, 1.0);    // VCO Saw -> VCF
    wasmExports.brack_patch_connect(adsrId, 0, vcfId, 1, 3.2);   // ADSR -> VCF Cutoff
    wasmExports.brack_patch_connect(adsrId, 0, vcaId, 1, 1.0);   // ADSR -> VCA
    wasmExports.brack_patch_connect(vcfId, 3, vcaId, 0, 1.0);    // VCF Moog -> VCA
    wasmExports.brack_patch_connect(vcaId, 0, delayId, 0, 1.0);  // VCA -> Delay
    wasmExports.brack_patch_connect(delayId, 0, outId, 0, 1.0);  // Delay L -> Out L
    wasmExports.brack_patch_connect(delayId, 1, outId, 1, 1.0);  // Delay R -> Out R
}

async function startAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        await initWasm();
        wasmExports.brack_set_sample_rate(audioCtx.sampleRate);

        // Audio node processing loop
        const bufferSize = 512;
        scriptNode = audioCtx.createScriptProcessor(bufferSize, 0, 2);

        scriptNode.onaudioprocess = (e) => {
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);

            // Process in 128-sample blocks
            for (let offset = 0; offset < bufferSize; offset += BLOCK_SIZE) {
                wasmExports.brack_render_block(outLeftPtr, outRightPtr, BLOCK_SIZE);
                const lView = new Float32Array(wasmExports.memory.buffer, outLeftPtr, BLOCK_SIZE);
                const rView = new Float32Array(wasmExports.memory.buffer, outRightPtr, BLOCK_SIZE);

                for (let i = 0; i < BLOCK_SIZE; i++) {
                    outL[offset + i] = lView[i];
                    outR[offset + i] = rView[i];
                }
            }
        };

        scriptNode.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

// UI Setup & Knob bindings
window.addEventListener('DOMContentLoaded', () => {
    const btnPower = document.getElementById('btn-power');
    const canvas = document.getElementById('scope');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = canvas.clientWidth * window.devicePixelRatio;
        canvas.height = canvas.clientHeight * window.devicePixelRatio;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    btnPower.addEventListener('click', async () => {
        if (!isPlaying) {
            await startAudio();
            btnPower.classList.add('active');
            btnPower.textContent = 'STOP AUDIO';
            isPlaying = true;
        } else {
            if (audioCtx) await audioCtx.suspend();
            btnPower.classList.remove('active');
            btnPower.textContent = 'START AUDIO';
            isPlaying = false;
        }
    });

    // Knob Listeners
    const bindKnob = (id, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', (e) => callback(parseFloat(e.target.value)));
    };

    bindKnob('clock-bpm', (val) => {
        if (wasmExports) wasmExports.brack_module_set_param(clockId, 0, val);
        document.getElementById('clock-bpm-val').textContent = `${Math.round(val)} BPM`;
    });
    bindKnob('vco-freq', (val) => wasmExports && wasmExports.brack_module_set_param(vcoId, 3, val));
    bindKnob('vco-pw', (val) => wasmExports && wasmExports.brack_module_set_param(vcoId, 4, val));
    bindKnob('vcf-cutoff', (val) => wasmExports && wasmExports.brack_module_set_param(vcfId, 0, val));
    bindKnob('vcf-res', (val) => wasmExports && wasmExports.brack_module_set_param(vcfId, 1, val));
    bindKnob('vcf-drive', (val) => wasmExports && wasmExports.brack_module_set_param(vcfId, 2, val));
    bindKnob('adsr-a', (val) => wasmExports && wasmExports.brack_module_set_param(adsrId, 0, val));
    bindKnob('adsr-d', (val) => wasmExports && wasmExports.brack_module_set_param(adsrId, 1, val));
    bindKnob('adsr-s', (val) => wasmExports && wasmExports.brack_module_set_param(adsrId, 2, val));
    bindKnob('delay-time', (val) => wasmExports && wasmExports.brack_module_set_param(delayId, 0, val));
    bindKnob('delay-fb', (val) => wasmExports && wasmExports.brack_module_set_param(delayId, 1, val));
    bindKnob('delay-mix', (val) => wasmExports && wasmExports.brack_module_set_param(delayId, 3, val));
    bindKnob('master-vol', (val) => wasmExports && wasmExports.brack_module_set_param(outId, 0, val));

    // 60FPS Oscilloscope Render Loop
    function renderScope() {
        requestAnimationFrame(renderScope);

        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = '#090a0f';
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = '#181b26';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        if (!wasmExports || !isPlaying) return;

        const scopePtr = wasmExports.brack_get_scope_left();
        const scopeSize = wasmExports.brack_get_scope_size();
        const scopeData = new Float32Array(wasmExports.memory.buffer, scopePtr, scopeSize);

        // Draw waveform
        ctx.strokeStyle = '#2ed573';
        ctx.lineWidth = 2 * window.devicePixelRatio;
        ctx.beginPath();

        const step = w / scopeSize;
        for (let i = 0; i < scopeSize; i++) {
            const x = i * step;
            const y = (0.5 - scopeData[i] * 0.45) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    renderScope();
});
