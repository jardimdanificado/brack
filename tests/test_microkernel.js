/**
 * Brack Microkernel Test
 * 3 Link Types: AUDIO (0), MIDI (1), VAL (2)
 * Loads core.wasm and individual modules/*.wasm dynamically.
 * Routes them together via the dynamic multi-link matrix.
 */

const fs = require('fs');
const path = require('path');

const LINK_AUDIO = 0;
const LINK_MIDI  = 1;
const LINK_VAL   = 2;

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
    const slotClock = core.brack_slot_create();
    const slotSeq   = core.brack_slot_create();
    const slotVco   = core.brack_slot_create();
    const slotVcf   = core.brack_slot_create();
    const slotAdsr  = core.brack_slot_create();
    const slotVca   = core.brack_slot_create();
    const slotDelay = core.brack_slot_create();
    const slotOut   = core.brack_slot_create();

    console.log(`[Brack Microkernel] Slots created in core: Clock=${slotClock}, Seq=${slotSeq}, VCO=${slotVco}, VCF=${slotVcf}, ADSR=${slotAdsr}, VCA=${slotVca}, Delay=${slotDelay}, Out=${slotOut}`);

    // Set Module Parameters
    modClock.b_module_set_param(0, 132.0); // 132 BPM

    // Acid Pattern Notes
    const notes = [0.0, 3.0, 7.0, 10.0, 12.0, 10.0, 7.0, 3.0];
    for (let s = 0; s < 8; s++) {
        modSeq.b_module_set_param(s, notes[s]);
    }

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

    console.log('[Brack Microkernel] Connecting dynamic multi-links in host matrix...');
    
    // 1. Clock (VAL out 0) -> Seq (VAL in)
    core.brack_link_connect(slotClock, 0, slotSeq, LINK_VAL, 1.0);

    // 2. Seq (MIDI out 0) -> VCO (MIDI in)
    core.brack_link_connect(slotSeq, 0, slotVco, LINK_MIDI, 1.0);

    // 3. Seq (GATE VAL out 2) -> ADSR (VAL in)
    core.brack_link_connect(slotSeq, 2, slotAdsr, LINK_VAL, 1.0);

    // 4. VCO (AUDIO out 0) -> VCF (AUDIO in)
    core.brack_link_connect(slotVco, 0, slotVcf, LINK_AUDIO, 1.0);

    // 5. ADSR (VAL out 0) -> VCF (VAL in, Cutoff modulation)
    core.brack_link_connect(slotAdsr, 0, slotVcf, LINK_VAL, 3.2);

    // 6. VCF (AUDIO out 0) -> VCA (AUDIO in)
    core.brack_link_connect(slotVcf, 0, slotVca, LINK_AUDIO, 1.0);

    // 7. ADSR (VAL out 0) -> VCA (VAL in, Gain envelope)
    core.brack_link_connect(slotAdsr, 0, slotVca, LINK_VAL, 1.0);

    // 8. VCA (AUDIO out 0) -> Delay (AUDIO in)
    core.brack_link_connect(slotVca, 0, slotDelay, LINK_AUDIO, 1.0);

    // 9. Delay (AUDIO out 0) -> Out (AUDIO in)
    core.brack_link_connect(slotDelay, 0, slotOut, LINK_AUDIO, 1.0);

    const modules = [
        { exports: modClock, slot: slotClock },
        { exports: modSeq,   slot: slotSeq },
        { exports: modVco,   slot: slotVco },
        { exports: modAdsr,  slot: slotAdsr },
        { exports: modVcf,   slot: slotVcf },
        { exports: modVca,   slot: slotVca },
        { exports: modDelay, slot: slotDelay },
        { exports: modOut,   slot: slotOut }
    ];

    // Allocate module scratch in-links and out-links buffers in module memory
    // In-links entry: struct { uint8 type, uint16 src_slot, uint16 src_out_idx, float gain, float* audio, midi_ev* midi, uint32 midi_count, float val } = ~32 bytes
    // Out-links entry: struct { uint8 type, float* audio, midi_ev* midi, uint32 midi_count, float val } = ~24 bytes
    for (const m of modules) {
        m.inLinksPtr  = 4096;
        m.outLinksPtr = 8192;
        m.outCountPtr = 12288;
        m.audioBufPtr = 16384; // 16 buffers of 128 floats = 16 * 512 = 8192 bytes
        m.midiBufPtr  = 32768;

        // Initialize out_links pointers inside module memory
        const u32 = new Uint32Array(m.exports.memory.buffer);
        for (let o = 0; o < 16; o++) {
            const outEntryOffset = (m.outLinksPtr + o * 24) >> 2;
            u32[outEntryOffset + 1] = m.audioBufPtr + o * BLOCK_SIZE * 4; // audio ptr
            u32[outEntryOffset + 2] = m.midiBufPtr + o * 64 * 8;         // midi ptr
        }
    }

    const leftChannel = new Float32Array(TOTAL_SAMPLES);
    const rightChannel = new Float32Array(TOTAL_SAMPLES);

    console.log(`[Brack Microkernel] Rendering ${DURATION_SEC}s audio across ${modules.length} independent WASM instances...`);
    const startTime = performance.now();

    for (let b = 0; b < TOTAL_BLOCKS; b++) {
        // 1. Core prepares block
        core.brack_core_prepare_block(BLOCK_SIZE);

        // 2. Process each module
        for (const m of modules) {
            const inCount = core.brack_slot_get_in_links_count(m.slot);
            const inLinksPtrCore = core.brack_slot_get_in_links_ptr(m.slot);

            const modU32 = new Uint32Array(m.exports.memory.buffer);
            const modF32 = new Float32Array(m.exports.memory.buffer);
            const coreU32 = new Uint32Array(coreMemory.buffer);
            const coreF32 = new Float32Array(coreMemory.buffer);

            // Copy in_links from core into module
            for (let i = 0; i < inCount; i++) {
                // brack_in_link_t structure layout (32 bytes):
                // offset 0 (u8): type
                // offset 2 (u16): src_slot
                // offset 4 (u16): src_out_idx
                // offset 8 (f32): gain
                // offset 12 (u32): audio ptr
                // offset 16 (u32): midi ptr
                // offset 20 (u32): midi_count
                // offset 24 (f32): val
                const coreLinkBase = (inLinksPtrCore >> 2) + (i * 8);
                const modLinkBase  = (m.inLinksPtr >> 2) + (i * 8);

                const type = coreU32[coreLinkBase] & 0xFF;
                modU32[modLinkBase] = coreU32[coreLinkBase]; // type, src_slot, src_out_idx
                modF32[modLinkBase + 2] = coreF32[coreLinkBase + 2]; // gain
                modF32[modLinkBase + 6] = coreF32[coreLinkBase + 6]; // val

                if (type === LINK_AUDIO) {
                    const audioPtrCore = coreU32[coreLinkBase + 3];
                    const audioScratchMod = m.audioBufPtr + (8 + i) * BLOCK_SIZE * 4;
                    modU32[modLinkBase + 3] = audioScratchMod;
                    if (audioPtrCore !== 0) {
                        const srcIdx = audioPtrCore >> 2;
                        const dstIdx = audioScratchMod >> 2;
                        for (let s = 0; s < BLOCK_SIZE; s++) {
                            modF32[dstIdx + s] = coreF32[srcIdx + s];
                        }
                    }
                } else if (type === LINK_MIDI) {
                    const midiCount = coreU32[coreLinkBase + 5];
                    modU32[modLinkBase + 5] = midiCount;
                    const midiPtrCore = coreU32[coreLinkBase + 4];
                    const midiScratchMod = m.midiBufPtr + (8 + i) * 64 * 8;
                    modU32[modLinkBase + 4] = midiScratchMod;
                    if (midiPtrCore !== 0 && midiCount > 0) {
                        const srcIdx = midiPtrCore >> 2;
                        const dstIdx = midiScratchMod >> 2;
                        for (let s = 0; s < midiCount * 2; s++) {
                            modU32[dstIdx + s] = coreU32[srcIdx + s];
                        }
                    }
                }
            }

            // Execute module process
            m.exports.b_module_process(0, m.inLinksPtr, inCount, m.outLinksPtr, m.outCountPtr, BLOCK_SIZE);

            // Copy out_links back to core
            const outCount = modU32[m.outCountPtr >> 2] || 1;
            const coreOutLinksPtr = core.brack_slot_get_out_links_ptr(m.slot);

            for (let o = 0; o < outCount; o++) {
                const modOutBase = (m.outLinksPtr >> 2) + (o * 6);
                const coreOutBase = (coreOutLinksPtr >> 2) + (o * 6);

                const type = modU32[modOutBase] & 0xFF;
                coreU32[coreOutBase] = type;
                coreF32[coreOutBase + 4] = modF32[modOutBase + 4]; // val
                const midiCount = modU32[modOutBase + 3];
                coreU32[coreOutBase + 3] = midiCount;

                if (type === LINK_AUDIO) {
                    const modAudioPtr = modU32[modOutBase + 1];
                    const coreAudioPtr = coreU32[coreOutBase + 1];
                    if (modAudioPtr && coreAudioPtr) {
                        const srcIdx = modAudioPtr >> 2;
                        const dstIdx = coreAudioPtr >> 2;
                        for (let s = 0; s < BLOCK_SIZE; s++) {
                            coreF32[dstIdx + s] = modF32[srcIdx + s];
                        }
                    }
                } else if (type === LINK_MIDI && midiCount > 0) {
                    const modMidiPtr = modU32[modOutBase + 2];
                    const coreMidiPtr = coreU32[coreOutBase + 2];
                    if (modMidiPtr && coreMidiPtr) {
                        const srcIdx = modMidiPtr >> 2;
                        const dstIdx = coreMidiPtr >> 2;
                        for (let s = 0; s < midiCount * 2; s++) {
                            coreU32[dstIdx + s] = modU32[srcIdx + s];
                        }
                    }
                }
            }

            core.brack_core_route_slot_outputs(m.slot);
        }

        // 3. Core finishes block
        core.brack_core_finish_block(BLOCK_SIZE);

        // Record Master Out
        const outModule = modules[modules.length - 1];
        const outSlotF32 = new Float32Array(outModule.exports.memory.buffer);
        const lOffset = (outModule.audioBufPtr) >> 2;
        const rOffset = (outModule.audioBufPtr + BLOCK_SIZE * 4) >> 2;

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

