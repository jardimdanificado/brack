/**
 * Brack Modular Synth Test Script
 * Loads brack.wasm, creates an Acid Bassline modular patch, and renders to a WAV file.
 */

const fs = require('fs');
const path = require('path');

async function main() {
    const wasmPath = path.join(__dirname, '../roms/brack.wasm');
    const wasmBuffer = fs.readFileSync(wasmPath);
    
    const wasmModule = await WebAssembly.instantiate(wasmBuffer, {
        env: {
            // No imports needed (freestanding)
        }
    });

    const exports = wasmModule.instance.exports;
    const memory = exports.memory;

    const SAMPLE_RATE = 48000;
    const BLOCK_SIZE = 128;
    const DURATION_SEC = 8; // 8 seconds of music
    const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SEC;
    const TOTAL_BLOCKS = Math.ceil(TOTAL_SAMPLES / BLOCK_SIZE);

    console.log('[Brack] Initializing core audio engine...');
    exports.brack_init(SAMPLE_RATE);
    exports.brack_set_bpm(130.0);

    // Module enum IDs
    const MOD_VCO = 1;
    const MOD_VCF = 2;
    const MOD_VCA = 3;
    const MOD_ADSR = 4;
    const MOD_LFO = 5;
    const MOD_SEQ = 6;
    const MOD_DELAY = 8;
    const MOD_CLOCK = 11;
    const MOD_OUT = 12;

    console.log('[Brack] Creating Eurorack modules in rack...');
    const clockId = exports.brack_module_create(MOD_CLOCK);
    const seqId   = exports.brack_module_create(MOD_SEQ);
    const vcoId   = exports.brack_module_create(MOD_VCO);
    const vcfId   = exports.brack_module_create(MOD_VCF);
    const adsrId  = exports.brack_module_create(MOD_ADSR);
    const vcaId   = exports.brack_module_create(MOD_VCA);
    const delayId = exports.brack_module_create(MOD_DELAY);
    const outId   = exports.brack_module_create(MOD_OUT);

    console.log(`[Brack] Modules instantiated: Clock=${clockId}, Seq=${seqId}, VCO=${vcoId}, VCF=${vcfId}, ADSR=${adsrId}, VCA=${vcaId}, Delay=${delayId}, Out=${outId}`);

    // Configure Clock (130 BPM)
    exports.brack_module_set_param(clockId, 0, 130.0);

    // Configure 8-step Acid Bassline pattern (Voltages in 1V/Oct relative to C2)
    // Notes: C2 (0.0), C3 (1.0), Eb2 (3/12), F2 (5/12), G2 (7/12), Bb2 (10/12), C2 (0.0), Eb3 (1.25)
    const notes = [
        0.0,            // C2
        1.0,            // C3 (Octave up)
        3.0 / 12.0,     // Eb2
        5.0 / 12.0,     // F2
        7.0 / 12.0,     // G2
        10.0 / 12.0,    // Bb2
        0.0,            // C2
        15.0 / 12.0     // Eb3
    ];

    for (let step = 0; step < 8; step++) {
        exports.brack_module_set_param(seqId, step, notes[step]);      // Pitch CV
        exports.brack_module_set_param(seqId, 8 + step, 1.0);          // Gate On
    }
    exports.brack_module_set_param(seqId, 16, 8.0); // 8 steps loop

    // Configure VCO: Saw wave with fat base frequency (65.4 Hz = C2)
    exports.brack_module_set_param(vcoId, 3, 65.40639); // Base freq C2
    exports.brack_module_set_param(vcoId, 6, 0.0);      // 0 = Saw wave

    // Configure ADSR: Punchy acid envelope
    exports.brack_module_set_param(adsrId, 0, 0.005); // Attack: 5ms
    exports.brack_module_set_param(adsrId, 1, 0.160); // Decay: 160ms
    exports.brack_module_set_param(adsrId, 2, 0.150); // Sustain: 15%
    exports.brack_module_set_param(adsrId, 3, 0.080); // Release: 80ms

    // Configure VCF: Moog 24dB ladder filter with resonant squelch
    exports.brack_module_set_param(vcfId, 0, 350.0);  // Base cutoff: 350 Hz
    exports.brack_module_set_param(vcfId, 1, 0.78);   // Resonance: 78% (screaming acid resonance)
    exports.brack_module_set_param(vcfId, 2, 1.8);    // Drive: 1.8x warm saturation

    // Configure VCA
    exports.brack_module_set_param(vcaId, 0, 0.0);    // Initial gain: 0
    exports.brack_module_set_param(vcaId, 1, 1.0);    // Exponential response

    // Configure Delay: Stereo tape delay with subtle feedback
    exports.brack_module_set_param(delayId, 0, 0.230); // 230ms delay
    exports.brack_module_set_param(delayId, 1, 0.40);  // Feedback: 40%
    exports.brack_module_set_param(delayId, 2, 0.45);  // Tape Damping: 45%
    exports.brack_module_set_param(delayId, 3, 0.30);  // Mix: 30% Wet

    // Configure Master Out
    exports.brack_module_set_param(outId, 0, 0.85); // Master volume: 85%

    console.log('[Brack] Patching Eurorack cables...');
    // Cable 0: Clock 1/16th (port 0) -> Sequencer Clock In (port 0)
    exports.brack_patch_connect(clockId, 0, seqId, 0, 1.0);

    // Cable 1: Sequencer Pitch CV (port 0) -> VCO 1V/OCT (port 0)
    exports.brack_patch_connect(seqId, 0, vcoId, 0, 1.0);

    // Cable 2: Sequencer Gate (port 1) -> ADSR Gate In (port 0)
    exports.brack_patch_connect(seqId, 1, adsrId, 0, 1.0);

    // Cable 3: VCO Saw Out (port 1) -> VCF Audio In (port 0)
    exports.brack_patch_connect(vcoId, 1, vcfId, 0, 1.0);

    // Cable 4: ADSR Envelope CV (port 0) -> VCF Cutoff CV (port 1) [Mod depth: 3.2 Octaves]
    exports.brack_patch_connect(adsrId, 0, vcfId, 1, 3.2);

    // Cable 5: ADSR Envelope CV (port 0) -> VCA Level CV (port 1)
    exports.brack_patch_connect(adsrId, 0, vcaId, 1, 1.0);

    // Cable 6: VCF Moog 24dB Out (port 3) -> VCA Audio In (port 0)
    exports.brack_patch_connect(vcfId, 3, vcaId, 0, 1.0);

    // Cable 7: VCA Audio Out (port 0) -> Delay In (port 0)
    exports.brack_patch_connect(vcaId, 0, delayId, 0, 1.0);

    // Cable 8: Delay Out L (port 0) -> Master Out L (port 0)
    exports.brack_patch_connect(delayId, 0, outId, 0, 1.0);

    // Cable 9: Delay Out R (port 1) -> Master Out R (port 1)
    exports.brack_patch_connect(delayId, 1, outId, 1, 1.0);

    console.log('[Brack] Allocating rendering buffers...');
    // Allocate 128 floats for left and right output pointers in WASM memory
    const outLeftPtr = 1024;
    const outRightPtr = 1024 + BLOCK_SIZE * 4;

    const leftChannel = new Float32Array(TOTAL_SAMPLES);
    const rightChannel = new Float32Array(TOTAL_SAMPLES);

    console.log(`[Brack] Rendering ${DURATION_SEC}s of audio (${TOTAL_BLOCKS} blocks @ ${SAMPLE_RATE}Hz)...`);
    const startTime = performance.now();

    for (let b = 0; b < TOTAL_BLOCKS; b++) {
        exports.brack_render_block(outLeftPtr, outRightPtr, BLOCK_SIZE);

        const lView = new Float32Array(memory.buffer, outLeftPtr, BLOCK_SIZE);
        const rView = new Float32Array(memory.buffer, outRightPtr, BLOCK_SIZE);

        const sampleOffset = b * BLOCK_SIZE;
        for (let s = 0; s < BLOCK_SIZE && (sampleOffset + s) < TOTAL_SAMPLES; s++) {
            leftChannel[sampleOffset + s] = lView[s];
            rightChannel[sampleOffset + s] = rView[s];
        }
    }

    const elapsed = (performance.now() - startTime).toFixed(2);
    console.log(`[Brack] Synthesis complete in ${elapsed}ms! (${(DURATION_SEC / (elapsed / 1000)).toFixed(1)}x real-time speed)`);

    // Write WAV file
    const outputPath = path.join(__dirname, 'output.wav');
    writeWavFile(outputPath, leftChannel, rightChannel, SAMPLE_RATE);
    console.log(`[Brack] Saved output WAV to ${outputPath}`);
}

function writeWavFile(filename, left, right, sampleRate) {
    const numChannels = 2;
    const bytesPerSample = 2; // 16-bit PCM
    const numSamples = left.length;
    const dataSize = numSamples * numChannels * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt subchunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // subchunk size
    buffer.writeUInt16LE(1, 20);  // PCM format
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byte rate
    buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // block align
    buffer.writeUInt16LE(16, 34); // bits per sample

    // data subchunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        let l = Math.max(-1.0, Math.min(1.0, left[i]));
        let r = Math.max(-1.0, Math.min(1.0, right[i]));

        let intL = Math.floor(l < 0 ? l * 32768 : l * 32767);
        let intR = Math.floor(r < 0 ? r * 32768 : r * 32767);

        buffer.writeInt16LE(intL, offset);
        buffer.writeInt16LE(intR, offset + 2);
        offset += 4;
    }

    fs.writeFileSync(filename, buffer);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
