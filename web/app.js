/**
 * Brack SunVox / PureData Node Graph Controller
 * Connects Quadro C Node Visualizer (60 FPS) with Audio Microkernel + Sandboxed DSP Modules
 */

let audioCtx = null;
let scriptNode = null;
let isPlaying = false;

// WASM Instances
let coreWasm = null;
let graphWasm = null;
let moduleInstances = {};

const BLOCK_SIZE = 128;
const CANVAS_W = 1280;
const CANVAS_H = 720;

// Node metadata lookup
const nodeSlotMap = {};
const moduleDefs = [];

async function loadWasm(url) {
    const res = await fetch(url);
    const bytes = await res.arrayBuffer();
    const mod = await WebAssembly.instantiate(bytes, { env: {} });
    return mod.instance.exports;
}

async function initGraph() {
    console.log('[Brack] Loading WASM Core & SunVox/PureData Quadro Graph...');
    coreWasm  = await loadWasm('../roms/core.wasm');
    graphWasm = await loadWasm('../roms/node_graph.wasm');

    const moduleNames = ['clock', 'seq', 'vco', 'vcf', 'adsr', 'vca', 'delay', 'out'];
    for (const name of moduleNames) {
        moduleInstances[name] = await loadWasm(`../modules/${name}.wasm`);
    }

    graphWasm.node_graph_init(CANVAS_W, CANVAS_H);

    const SAMPLE_RATE = 48000;
    coreWasm.brack_core_init(SAMPLE_RATE);
    coreWasm.brack_core_set_bpm(132.0);

    for (const name of moduleNames) {
        moduleInstances[name].b_module_init(SAMPLE_RATE);
    }

    // Register audio slots
    const slots = {
        clock: coreWasm.brack_slot_create(0, 4),
        seq:   coreWasm.brack_slot_create(2, 2),
        vco:   coreWasm.brack_slot_create(4, 5),
        vcf:   coreWasm.brack_slot_create(3, 4),
        adsr:  coreWasm.brack_slot_create(2, 2),
        vca:   coreWasm.brack_slot_create(2, 1),
        delay: coreWasm.brack_slot_create(2, 2),
        out:   coreWasm.brack_slot_create(2, 2)
    };

    buildSunVoxNodes(slots);
    setupDefaultWires(slots);
}

function buildSunVoxNodes(slots) {
    // Categories: 0=Gen, 1=Filter, 2=Mod, 3=Control, 4=Effect, 5=Out

    // 1. CLOCK (Control - Yellow)
    const nClock = graphWasm.node_graph_add_node(slots.clock, "MASTER CLOCK", 3, 40, 50, 160, 160);
    graphWasm.node_graph_add_outlet(nClock, 0, 2, "1/16");
    graphWasm.node_graph_add_outlet(nClock, 1, 2, "1/8");
    graphWasm.node_graph_add_outlet(nClock, 2, 2, "1/4");
    graphWasm.node_graph_add_slider(nClock, 0, "BPM", 132.0, 30.0, 240.0);
    nodeSlotMap[nClock] = { name: 'clock', slot: slots.clock };

    // 2. SEQ-8 (Control - Yellow)
    const nSeq = graphWasm.node_graph_add_node(slots.seq, "SEQ-8 ACID", 3, 230, 50, 170, 240);
    graphWasm.node_graph_add_inlet(nSeq, 0, 2, "CLK");
    graphWasm.node_graph_add_inlet(nSeq, 1, 2, "RST");
    graphWasm.node_graph_add_outlet(nSeq, 0, 1, "CV");
    graphWasm.node_graph_add_outlet(nSeq, 1, 2, "GATE");
    for (let s = 0; s < 4; s++) {
        graphWasm.node_graph_add_slider(nSeq, s, `STEP ${s+1}`, 0.0, -2.0, 2.0);
    }
    nodeSlotMap[nSeq] = { name: 'seq', slot: slots.seq };

    // 3. VCO (Generator - Cyan)
    const nVco = graphWasm.node_graph_add_node(slots.vco, "VCO POLYBLEP", 0, 430, 50, 180, 200);
    graphWasm.node_graph_add_inlet(nVco, 0, 1, "V/OCT");
    graphWasm.node_graph_add_inlet(nVco, 1, 1, "PWM");
    graphWasm.node_graph_add_outlet(nVco, 0, 0, "MIX");
    graphWasm.node_graph_add_outlet(nVco, 1, 0, "SAW");
    graphWasm.node_graph_add_outlet(nVco, 2, 0, "SQR");
    graphWasm.node_graph_add_slider(nVco, 3, "FREQ (Hz)", 65.4, 30.0, 500.0);
    graphWasm.node_graph_add_slider(nVco, 4, "PW (%)", 0.5, 0.05, 0.95);
    nodeSlotMap[nVco] = { name: 'vco', slot: slots.vco };

    // 4. ADSR (Modulator - Purple)
    const nAdsr = graphWasm.node_graph_add_node(slots.adsr, "ADSR ENVELOPE", 2, 430, 340, 180, 240);
    graphWasm.node_graph_add_inlet(nAdsr, 0, 2, "GATE");
    graphWasm.node_graph_add_inlet(nAdsr, 1, 2, "RETRIG");
    graphWasm.node_graph_add_outlet(nAdsr, 0, 1, "ENV");
    graphWasm.node_graph_add_slider(nAdsr, 0, "ATTACK", 0.005, 0.001, 1.0);
    graphWasm.node_graph_add_slider(nAdsr, 1, "DECAY", 0.160, 0.01, 2.0);
    graphWasm.node_graph_add_slider(nAdsr, 2, "SUSTAIN", 0.150, 0.0, 1.0);
    graphWasm.node_graph_add_slider(nAdsr, 3, "RELEASE", 0.080, 0.01, 3.0);
    nodeSlotMap[nAdsr] = { name: 'adsr', slot: slots.adsr };

    // 5. VCF MOOG (Filter - Orange)
    const nVcf = graphWasm.node_graph_add_node(slots.vcf, "24dB MOOG LADDER", 1, 650, 50, 190, 220);
    graphWasm.node_graph_add_inlet(nVcf, 0, 0, "AUDIO");
    graphWasm.node_graph_add_inlet(nVcf, 1, 1, "CUTOFF");
    graphWasm.node_graph_add_inlet(nVcf, 2, 1, "RES");
    graphWasm.node_graph_add_outlet(nVcf, 0, 0, "MOOG OUT");
    graphWasm.node_graph_add_slider(nVcf, 0, "CUTOFF", 420.0, 30.0, 8000.0);
    graphWasm.node_graph_add_slider(nVcf, 1, "RESONANCE", 0.80, 0.0, 0.98);
    graphWasm.node_graph_add_slider(nVcf, 2, "DRIVE", 1.8, 1.0, 5.0);
    nodeSlotMap[nVcf] = { name: 'vcf', slot: slots.vcf };

    // 6. VCA (Generator/Amp - Cyan)
    const nVca = graphWasm.node_graph_add_node(slots.vca, "VCA AMPLIFIER", 0, 650, 340, 170, 170);
    graphWasm.node_graph_add_inlet(nVca, 0, 0, "AUDIO");
    graphWasm.node_graph_add_inlet(nVca, 1, 1, "LEVEL CV");
    graphWasm.node_graph_add_outlet(nVca, 0, 0, "OUT");
    graphWasm.node_graph_add_slider(nVca, 0, "BASE GAIN", 0.0, 0.0, 1.0);
    nodeSlotMap[nVca] = { name: 'vca', slot: slots.vca };

    // 7. DELAY (Effect - Green)
    const nDelay = graphWasm.node_graph_add_node(slots.delay, "TAPE DELAY", 4, 870, 180, 180, 220);
    graphWasm.node_graph_add_inlet(nDelay, 0, 0, "IN L");
    graphWasm.node_graph_add_inlet(nDelay, 1, 1, "TIME CV");
    graphWasm.node_graph_add_outlet(nDelay, 0, 0, "OUT L");
    graphWasm.node_graph_add_outlet(nDelay, 1, 0, "OUT R");
    graphWasm.node_graph_add_slider(nDelay, 0, "TIME (s)", 0.227, 0.02, 1.5);
    graphWasm.node_graph_add_slider(nDelay, 1, "FEEDBACK", 0.45, 0.0, 0.95);
    graphWasm.node_graph_add_slider(nDelay, 3, "DRY/WET", 0.32, 0.0, 1.0);
    nodeSlotMap[nDelay] = { name: 'delay', slot: slots.delay };

    // 8. MASTER OUT (Output - Red)
    const nOut = graphWasm.node_graph_add_node(slots.out, "MASTER OUTPUT", 5, 1080, 180, 170, 170);
    graphWasm.node_graph_add_inlet(nOut, 0, 0, "IN L");
    graphWasm.node_graph_add_inlet(nOut, 1, 0, "IN R");
    graphWasm.node_graph_add_slider(nOut, 0, "VOLUME", 0.85, 0.0, 1.5);
    nodeSlotMap[nOut] = { name: 'out', slot: slots.out };
}

function setupDefaultWires(slots) {
    // 8-step Acid Notes
    const notes = [0.0, 1.0, 3/12, 5/12, 7/12, 10/12, 0.0, 15/12];
    for (let s = 0; s < 8; s++) {
        moduleInstances['seq'].b_module_set_param(s, notes[s]);
        moduleInstances['seq'].b_module_set_param(8 + s, 1.0);
    }
    moduleInstances['seq'].b_module_set_param(16, 8.0);

    // Default wire connections
    // Clock 1/16 (node 0 out 0) -> Seq Clock (node 1 in 0)
    graphWasm.node_graph_connect_wire(0, 0, 1, 0, 0xFFfeca57);
    coreWasm.brack_cable_connect(slots.clock, 0, slots.seq, 0, 1.0);

    // Seq CV (node 1 out 0) -> VCO 1V/Oct (node 2 in 0)
    graphWasm.node_graph_connect_wire(1, 0, 2, 0, 0xFF00d2d3);
    coreWasm.brack_cable_connect(slots.seq, 0, slots.vco, 0, 1.0);

    // Seq Gate (node 1 out 1) -> ADSR Gate (node 3 in 0)
    graphWasm.node_graph_connect_wire(1, 1, 3, 0, 0xFFfeca57);
    coreWasm.brack_cable_connect(slots.seq, 1, slots.adsr, 0, 1.0);

    // VCO Saw (node 2 out 1) -> VCF Audio In (node 4 in 0)
    graphWasm.node_graph_connect_wire(2, 1, 4, 0, 0xFF00d2d3);
    coreWasm.brack_cable_connect(slots.vco, 1, slots.vcf, 0, 1.0);

    // ADSR Env (node 3 out 0) -> VCF Cutoff CV (node 4 in 1)
    graphWasm.node_graph_connect_wire(3, 0, 4, 1, 0xFF9c88ff);
    coreWasm.brack_cable_connect(slots.adsr, 0, slots.vcf, 1, 3.2);

    // ADSR Env (node 3 out 0) -> VCA Level CV (node 5 in 1)
    graphWasm.node_graph_connect_wire(3, 0, 5, 1, 0xFF9c88ff);
    coreWasm.brack_cable_connect(slots.adsr, 0, slots.vca, 1, 1.0);

    // VCF Moog Out (node 4 out 0) -> VCA Audio In (node 5 in 0)
    graphWasm.node_graph_connect_wire(4, 0, 5, 0, 0xFFff9f43);
    coreWasm.brack_cable_connect(slots.vcf, 0, slots.vca, 0, 1.0);

    // VCA Out (node 5 out 0) -> Delay In (node 6 in 0)
    graphWasm.node_graph_connect_wire(5, 0, 6, 0, 0xFF00d2d3);
    coreWasm.brack_cable_connect(slots.vca, 0, slots.delay, 0, 1.0);

    // Delay Out L/R (node 6 out 0, 1) -> Master In L/R (node 7 in 0, 1)
    graphWasm.node_graph_connect_wire(6, 0, 7, 0, 0xFF10ac84);
    graphWasm.node_graph_connect_wire(6, 1, 7, 1, 0xFF10ac84);
    coreWasm.brack_cable_connect(slots.delay, 0, slots.out, 0, 1.0);
    coreWasm.brack_cable_connect(slots.delay, 1, slots.out, 1, 1.0);
}

/* =========================================================================
 * Audio Synthesis Loop (Web Audio Worklet)
 * ========================================================================= */

async function startAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        coreWasm.brack_core_set_sample_rate(audioCtx.sampleRate);

        const bufferSize = 512;
        scriptNode = audioCtx.createScriptProcessor(bufferSize, 0, 2);

        const slotMap = { clock: 0, seq: 1, vco: 2, vcf: 3, adsr: 4, vca: 5, delay: 6, out: 7 };
        const names = ['clock', 'seq', 'vco', 'vcf', 'adsr', 'vca', 'delay', 'out'];
        const inPorts  = [0, 2, 4, 3, 2, 2, 2, 2];
        const outPorts = [4, 2, 5, 4, 2, 1, 2, 2];

        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const def = {
                name,
                slot: slotMap[name],
                inP: inPorts[i],
                outP: outPorts[i],
                inst: moduleInstances[name],
                inPtrs: [],
                outPtrs: []
            };

            for (let p = 0; p < def.inP; p++) def.inPtrs[p] = coreWasm.brack_slot_get_in_ptr(def.slot, p);
            for (let p = 0; p < def.outP; p++) def.outPtrs[p] = coreWasm.brack_slot_get_out_ptr(def.slot, p);

            def.inTablePtr = 2048;
            def.outTablePtr = 2048 + 16 * 4;
            def.inBufPtr = 4096;
            def.outBufPtr = 4096 + 16 * BLOCK_SIZE * 4;

            const u32 = new Uint32Array(def.inst.memory.buffer);
            for (let p = 0; p < def.inP; p++) u32[(def.inTablePtr >> 2) + p] = def.inBufPtr + p * BLOCK_SIZE * 4;
            for (let p = 0; p < def.outP; p++) u32[(def.outTablePtr >> 2) + p] = def.outBufPtr + p * BLOCK_SIZE * 4;

            moduleDefs.push(def);
        }

        scriptNode.onaudioprocess = (e) => {
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);

            for (let offset = 0; offset < bufferSize; offset += BLOCK_SIZE) {
                coreWasm.brack_core_prepare_block(BLOCK_SIZE);
                const coreF32 = new Float32Array(coreWasm.memory.buffer);

                for (let i = 0; i < moduleDefs.length; i++) {
                    const m = moduleDefs[i];
                    const modF32 = new Float32Array(m.inst.memory.buffer);

                    for (let p = 0; p < m.inP; p++) {
                        const sOff = m.inPtrs[p] >> 2;
                        const dOff = (m.inBufPtr + p * BLOCK_SIZE * 4) >> 2;
                        for (let s = 0; s < BLOCK_SIZE; s++) modF32[dOff + s] = coreF32[sOff + s];
                    }

                    m.inst.b_module_process(m.inTablePtr, m.outTablePtr, BLOCK_SIZE);

                    for (let p = 0; p < m.outP; p++) {
                        const sOff = (m.outBufPtr + p * BLOCK_SIZE * 4) >> 2;
                        const dOff = m.outPtrs[p] >> 2;
                        for (let s = 0; s < BLOCK_SIZE; s++) coreF32[dOff + s] = modF32[sOff + s];
                    }
                }

                coreWasm.brack_core_finish_block(BLOCK_SIZE);

                const outMod = moduleDefs[moduleDefs.length - 1];
                const outF32 = new Float32Array(outMod.inst.memory.buffer);
                const lOff = (outMod.outBufPtr) >> 2;
                const rOff = (outMod.outBufPtr + BLOCK_SIZE * 4) >> 2;

                for (let s = 0; s < BLOCK_SIZE; s++) {
                    outL[offset + s] = outF32[lOff + s];
                    outR[offset + s] = outF32[rOff + s];
                }
            }
        };

        scriptNode.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

/* =========================================================================
 * UI Interaction & 60 FPS Render Loop
 * ========================================================================= */

window.addEventListener('DOMContentLoaded', async () => {
    await initGraph();

    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(CANVAS_W, CANVAS_H);

    const btnPower = document.getElementById('btn-power');
    btnPower.addEventListener('click', async () => {
        if (!isPlaying) {
            await startAudio();
            btnPower.classList.add('active');
            btnPower.textContent = 'STOP AUDIO SYNTHESIS';
            isPlaying = true;
        } else {
            if (audioCtx) await audioCtx.suspend();
            btnPower.classList.remove('active');
            btnPower.textContent = 'START AUDIO SYNTHESIS';
            isPlaying = false;
        }
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        graphWasm.node_graph_clear_wires();
        coreWasm.brack_cable_clear();
        setupDefaultWires({
            clock: 0, seq: 1, vco: 2, vcf: 3, adsr: 4, vca: 5, delay: 6, out: 7
        });
    });

    function getCanvasPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        return {
            x: Math.round((e.clientX - rect.left) * scaleX),
            y: Math.round((e.clientY - rect.top) * scaleY)
        };
    }

    let isMouseDown = false;

    canvas.addEventListener('mousedown', (e) => {
        const pos = getCanvasPos(e);
        graphWasm.node_graph_mouse_down(pos.x, pos.y, e.button);
        isMouseDown = true;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const pos = getCanvasPos(e);

        const ptrNode = 1024;
        const ptrParam = 1028;
        const ptrVal = 1032;

        const sliderChanged = graphWasm.node_graph_mouse_move(pos.x, pos.y, ptrNode, ptrParam, ptrVal);
        if (sliderChanged) {
            const i32 = new Int32Array(graphWasm.memory.buffer);
            const f32 = new Float32Array(graphWasm.memory.buffer);
            const slotId  = i32[ptrNode >> 2];
            const paramId = i32[ptrParam >> 2];
            const val     = f32[ptrVal >> 2];

            const nameMap = ['clock', 'seq', 'vco', 'vcf', 'adsr', 'vca', 'delay', 'out'];
            const modName = nameMap[slotId];
            if (modName && moduleInstances[modName]) {
                moduleInstances[modName].b_module_set_param(paramId, val);
            }
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;
        const pos = getCanvasPos(e);

        const ptrSrcN = 1024;
        const ptrSrcO = 1028;
        const ptrDstN = 1032;
        const ptrDstI = 1036;

        const connected = graphWasm.node_graph_mouse_up(pos.x, pos.y, ptrSrcN, ptrSrcO, ptrDstN, ptrDstI);
        if (connected) {
            const i32 = new Int32Array(graphWasm.memory.buffer);
            const srcSlot = i32[ptrSrcN >> 2];
            const srcPort = i32[ptrSrcO >> 2];
            const dstSlot = i32[ptrDstN >> 2];
            const dstPort = i32[ptrDstI >> 2];

            const gain = (srcSlot === 4 && dstSlot === 3) ? 3.2 : 1.0;
            coreWasm.brack_cable_connect(srcSlot, srcPort, dstSlot, dstPort, gain);
            console.log(`[Brack Graph] Connected wire: Slot ${srcSlot} port ${srcPort} -> Slot ${dstSlot} port ${dstPort}`);
        }
        isMouseDown = false;
    });

    // 60 FPS Quadro Render Loop
    function renderLoop() {
        requestAnimationFrame(renderLoop);

        // Feed live waveforms into mini-displays of each node
        if (isPlaying && moduleDefs.length > 0) {
            for (let i = 0; i < moduleDefs.length; i++) {
                const m = moduleDefs[i];
                const modF32 = new Float32Array(m.inst.memory.buffer);
                const outOffset = (m.outBufPtr) >> 2;

                // Pass first 64 samples into node scope
                const scopePtr = 4096 + 32 * 128 * 4;
                const graphF32 = new Float32Array(graphWasm.memory.buffer);
                for (let s = 0; s < 64; s++) {
                    graphF32[(scopePtr >> 2) + s] = modF32[outOffset + s * 2];
                }
                graphWasm.node_graph_feed_scope(i, scopePtr, 64);
            }
        }

        // Render full node graph in C via Quadro
        graphWasm.node_graph_render();

        // Copy C framebuffer to HTML5 canvas
        const fbPtr = graphWasm.node_graph_get_framebuffer();
        const fbBytes = new Uint8ClampedArray(graphWasm.memory.buffer, fbPtr, CANVAS_W * CANVAS_H * 4);

        imgData.data.set(fbBytes);
        ctx.putImageData(imgData, 0, 0);
    }

    renderLoop();
});
