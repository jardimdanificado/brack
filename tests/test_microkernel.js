/**
 * Brack Microkernel Test
 * Loads core.wasm and individual modules/*.wasm dynamically.
 * Routes them together via the core matrix and synthesizes audio.
 */

const fs = require('fs');
const path = require('path');

async function loadWasm(filePath) {
    const buf = fs.readFileSync(filePath);
    const mod = await WebAssembly.instantiate(buf, { env: {} });
    return mod.instance.exports;
}

async function main() {
    console.log('[Brack Microkernel] Loading roms/core.wasm...');
    const core = await loadWasm(path.join(__dirname, '../roms/core.wasm'));
    const coreMemory = core.memory;

    console.log('[Brack Microkernel] Loading independent modules/*.wasm...');
    const modClock = await loadWasm(path.join(__dirname, '../modules/clock.wasm'));
    const modSeq   = await loadWasm(path.join(__dirname, '../modules/seq.wasm'));
    const modVco   = await loadWasm(path.join(__dirname, '../modules/vco.wasm'));
    const modVcf   = await loadWasm(path.join(__dirname, '../modules/vcf.wasm'));
    const modAdsr  = await loadWasm(path.join(__dirname, '../modules/adsr.wasm'));
    const modVca   = await loadWasm(path.join(__dirname, '../modules/vca.wasm'));
    const modDelay = await loadWasm(path.join(__dirname, '../modules/delay.wasm'));
    const modOut   = await loadWasm(path.join(__dirname, '../modules/out.wasm'));

    const SAMPLE_RATE = 48000;
    const BLOCK_SIZE = 128;
    const DURATION_SEC = 8;
    const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SEC;
    const TOTAL_BLOCKS = Math.ceil(TOTAL_SAMPLES / BLOCK_SIZE);

    core.brack_core_init(SAMPLE_RATE);
    core.brack_core_set_bpm(132.0);

    // Initialize module DSPs
    modClock.b_module_init(SAMPLE_RATE);
    modSeq.b_module_init(SAMPLE_RATE);
    modVco.b_module_init(SAMPLE_RATE);
    modVcf.b_module_init(SAMPLE_RATE);
    modAdsr.b_module_init(SAMPLE_RATE);
    modVca.b_module_init(SAMPLE_RATE);
    modDelay.b_module_init(SAMPLE_RATE);
    modOut.b_module_init(SAMPLE_RATE);

    // Register slots in core matrix
    const slotClock = core.brack_slot_create(0, 4); // in: 0, out: 4
    const slotSeq   = core.brack_slot_create(2, 2); // in: 2, out: 2
    const slotVco   = core.brack_slot_create(4, 5); // in: 4, out: 5
    const slotVcf   = core.brack_slot_create(3, 4); // in: 3, out: 4
    const slotAdsr  = core.brack_slot_create(2, 2); // in: 2, out: 2
    const slotVca   = core.brack_slot_create(2, 1); // in: 2, out: 1
    const slotDelay = core.brack_slot_create(2, 2); // in: 2, out: 2
    const slotOut   = core.brack_slot_create(2, 2); // in: 2, out: 2

    console.log(`[Brack Microkernel] Slots created in core: Clock=${slotClock}, Seq=${slotSeq}, VCO=${slotVco}, VCF=${slotVcf}, ADSR=${slotAdsr}, VCA=${slotVca}, Delay=${slotDelay}, Out=${slotOut}`);

    // Set Module Parameters
    modClock.b_module_set_param(0, 132.0); // 132 BPM

    // 8-step Acid Notes
    const notes = [0.0, 1.0, 3/12, 5/12, 7/12, 10/12, 0.0, 15/12];
    for (let s = 0; s < 8; s++) {
        modSeq.b_module_set_param(s, notes[s]);
        modSeq.b_module_set_param(8 + s, 1.0);
    }
    modSeq.b_module_set_param(16, 8.0);

    modVco.b_module_set_param(3, 65.406); // C2
    modVco.b_module_set_param(6, 0.0);    // Saw wave

    modAdsr.b_module_set_param(0, 0.005); // Attack 5ms
    modAdsr.b_module_set_param(1, 0.160); // Decay 160ms
    modAdsr.b_module_set_param(2, 0.150); // Sustain 15%
    modAdsr.b_module_set_param(3, 0.080); // Release 80ms

    modVcf.b_module_set_param(0, 420.0); // 420Hz Cutoff
    modVcf.b_module_set_param(1, 0.80);  // 80% Resonance
    modVcf.b_module_set_param(2, 1.8);   // 1.8x Drive

    modVca.b_module_set_param(0, 0.0);
    modVca.b_module_set_param(1, 1.0);   // Exp

    modDelay.b_module_set_param(0, 0.227); // 227ms
    modDelay.b_module_set_param(1, 0.45);  // Feedback
    modDelay.b_module_set_param(2, 0.40);  // Damp
    modDelay.b_module_set_param(3, 0.32);  // Wet/Dry

    modOut.b_module_set_param(0, 0.85); // Vol

    console.log('[Brack Microkernel] Connecting patch cables in host matrix...');
    // Clock 1/16 (out 0) -> Seq Clock (in 0)
    core.brack_cable_connect(slotClock, 0, slotSeq, 0, 1.0);

    // Seq CV (out 0) -> VCO 1V/Oct (in 0)
    core.brack_cable_connect(slotSeq, 0, slotVco, 0, 1.0);

    // Seq Gate (out 1) -> ADSR Gate (in 0)
    core.brack_cable_connect(slotSeq, 1, slotAdsr, 0, 1.0);

    // VCO Saw (out 1) -> VCF Audio In (in 0)
    core.brack_cable_connect(slotVco, 1, slotVcf, 0, 1.0);

    // ADSR Env (out 0) -> VCF Cutoff CV (in 1) with 3.2x depth
    core.brack_cable_connect(slotAdsr, 0, slotVcf, 1, 3.2);

    // ADSR Env (out 0) -> VCA CV (in 1)
    core.brack_cable_connect(slotAdsr, 0, slotVca, 1, 1.0);

    // VCF Moog 24dB (out 0) -> VCA Audio In (in 0)
    core.brack_cable_connect(slotVcf, 0, slotVca, 0, 1.0);

    // VCA Audio Out (out 0) -> Delay In (in 0)
    core.brack_cable_connect(slotVca, 0, slotDelay, 0, 1.0);

    // Delay Out L/R (out 0, 1) -> Out In L/R (in 0, 1)
    core.brack_cable_connect(slotDelay, 0, slotOut, 0, 1.0);
    core.brack_cable_connect(slotDelay, 1, slotOut, 1, 1.0);

    // Helper: bridge pointers between host core memory and individual module WASM memories
    // Each module has its input and output pointers
    function getSlotInPtr(slot, port) { return core.brack_slot_get_in_ptr(slot, port); }
    function getSlotOutPtr(slot, port) { return core.brack_slot_get_out_ptr(slot, port); }

    // Prepare module dispatch descriptors
    const modules = [
        {
            exports: modClock,
            slot: slotClock,
            inPorts: 0,
            outPorts: 4,
            inPtrs: [],
            outPtrs: [getSlotOutPtr(slotClock, 0), getSlotOutPtr(slotClock, 1), getSlotOutPtr(slotClock, 2), getSlotOutPtr(slotClock, 3)]
        },
        {
            exports: modSeq,
            slot: slotSeq,
            inPorts: 2,
            outPorts: 2,
            inPtrs: [getSlotInPtr(slotSeq, 0), getSlotInPtr(slotSeq, 1)],
            outPtrs: [getSlotOutPtr(slotSeq, 0), getSlotOutPtr(slotSeq, 1)]
        },
        {
            exports: modVco,
            slot: slotVco,
            inPorts: 4,
            outPorts: 5,
            inPtrs: [getSlotInPtr(slotVco, 0), getSlotInPtr(slotVco, 1), getSlotInPtr(slotVco, 2), getSlotInPtr(slotVco, 3)],
            outPtrs: [getSlotOutPtr(slotVco, 0), getSlotOutPtr(slotVco, 1), getSlotOutPtr(slotVco, 2), getSlotOutPtr(slotVco, 3), getSlotOutPtr(slotVco, 4)]
        },
        {
            exports: modVcf,
            slot: slotVcf,
            inPorts: 3,
            outPorts: 4,
            inPtrs: [getSlotInPtr(slotVcf, 0), getSlotInPtr(slotVcf, 1), getSlotInPtr(slotVcf, 2)],
            outPtrs: [getSlotOutPtr(slotVcf, 0), getSlotOutPtr(slotVcf, 1), getSlotOutPtr(slotVcf, 2), getSlotOutPtr(slotVcf, 3)]
        },
        {
            exports: modAdsr,
            slot: slotAdsr,
            inPorts: 2,
            outPorts: 2,
            inPtrs: [getSlotInPtr(slotAdsr, 0), getSlotInPtr(slotAdsr, 1)],
            outPtrs: [getSlotOutPtr(slotAdsr, 0), getSlotOutPtr(slotAdsr, 1)]
        },
        {
            exports: modVca,
            slot: slotVca,
            inPorts: 2,
            outPorts: 1,
            inPtrs: [getSlotInPtr(slotVca, 0), getSlotInPtr(slotVca, 1)],
            outPtrs: [getSlotOutPtr(slotVca, 0)]
        },
        {
            exports: modDelay,
            slot: slotDelay,
            inPorts: 2,
            outPorts: 2,
            inPtrs: [getSlotInPtr(slotDelay, 0), getSlotInPtr(slotDelay, 1)],
            outPtrs: [getSlotOutPtr(slotDelay, 0), getSlotOutPtr(slotDelay, 1)]
        },
        {
            exports: modOut,
            slot: slotOut,
            inPorts: 2,
            outPorts: 2,
            inPtrs: [getSlotInPtr(slotOut, 0), getSlotInPtr(slotOut, 1)],
            outPtrs: [getSlotOutPtr(slotOut, 0), getSlotOutPtr(slotOut, 1)]
        }
    ];

    // Build pointer arrays in each module's memory for C double-pointer inputs/outputs
    for (const m of modules) {
        m.inTablePtr = 2048;
        m.outTablePtr = 2048 + 16 * 4;
        m.inBufPtr = 4096;
        m.outBufPtr = 4096 + 16 * BLOCK_SIZE * 4;

        const tableU32 = new Uint32Array(m.exports.memory.buffer);
        for (let p = 0; p < m.inPorts; p++) {
            tableU32[(m.inTablePtr >> 2) + p] = m.inBufPtr + p * BLOCK_SIZE * 4;
        }
        for (let p = 0; p < m.outPorts; p++) {
            tableU32[(m.outTablePtr >> 2) + p] = m.outBufPtr + p * BLOCK_SIZE * 4;
        }
    }

    const leftChannel = new Float32Array(TOTAL_SAMPLES);
    const rightChannel = new Float32Array(TOTAL_SAMPLES);

    console.log(`[Brack Microkernel] Rendering ${DURATION_SEC}s audio across ${modules.length} independent WASM instances...`);
    const startTime = performance.now();

    for (let b = 0; b < TOTAL_BLOCKS; b++) {
        // 1. Core prepares block (zero inputs, sum cables, feed feedback)
        core.brack_core_prepare_block(BLOCK_SIZE);

        const coreF32 = new Float32Array(coreMemory.buffer);

        // 2. Process each module
        for (const m of modules) {
            const modF32 = new Float32Array(m.exports.memory.buffer);

            // Copy input buffers from host core memory into module memory
            for (let p = 0; p < m.inPorts; p++) {
                const srcOffset = m.inPtrs[p] >> 2;
                const dstOffset = (m.inBufPtr + p * BLOCK_SIZE * 4) >> 2;
                for (let s = 0; s < BLOCK_SIZE; s++) {
                    modF32[dstOffset + s] = coreF32[srcOffset + s];
                }
            }

            // Run module DSP process in its own WASM sandbox
            m.exports.b_module_process(m.inTablePtr, m.outTablePtr, BLOCK_SIZE);

            // Copy output buffers from module memory into host core memory
            for (let p = 0; p < m.outPorts; p++) {
                const srcOffset = (m.outBufPtr + p * BLOCK_SIZE * 4) >> 2;
                const dstOffset = m.outPtrs[p] >> 2;
                for (let s = 0; s < BLOCK_SIZE; s++) {
                    coreF32[dstOffset + s] = modF32[srcOffset + s];
                }
            }
        }

        // 3. Core finishes block (history buffers, scope)
        core.brack_core_finish_block(BLOCK_SIZE);

        // Record Master Out slot output to output array
        const outSlot = modules[modules.length - 1];
        const outSlotF32 = new Float32Array(outSlot.exports.memory.buffer);
        const lOffset = (outSlot.outBufPtr) >> 2;
        const rOffset = (outSlot.outBufPtr + BLOCK_SIZE * 4) >> 2;

        const sampleOffset = b * BLOCK_SIZE;
        for (let s = 0; s < BLOCK_SIZE && (sampleOffset + s) < TOTAL_SAMPLES; s++) {
            leftChannel[sampleOffset + s] = outSlotF32[lOffset + s];
            rightChannel[sampleOffset + s] = outSlotF32[rOffset + s];
        }
    }

    const elapsed = (performance.now() - startTime).toFixed(2);
    console.log(`[Brack Microkernel] Render complete in ${elapsed}ms! (${(DURATION_SEC / (elapsed / 1000)).toFixed(1)}x real-time)`);

    const outPath = path.join(__dirname, 'output_microkernel.wav');
    writeWav(outPath, leftChannel, rightChannel, SAMPLE_RATE);
    console.log(`[Brack Microkernel] Saved audio output to ${outPath}`);
}

function writeWav(filename, left, right, sampleRate) {
    const numChannels = 2;
    const bytesPerSample = 2;
    const numSamples = left.length;
    const dataSize = numSamples * numChannels * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);

    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
    buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
        let l = Math.max(-1.0, Math.min(1.0, left[i]));
        let r = Math.max(-1.0, Math.min(1.0, right[i]));
        buffer.writeInt16LE(Math.floor(l < 0 ? l * 32768 : l * 32767), offset);
        buffer.writeInt16LE(Math.floor(r < 0 ? r * 32768 : r * 32767), offset + 2);
        offset += 4;
    }
    fs.writeFileSync(filename, buffer);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
