/**
 * =========================================================================
 * BRACK Live-Scriptable Modular Controller (web/app.js)
 * 100% C-Rendered Blackboard + Live JavaScript Modules + Hot Reloading
 * =========================================================================
 */

import { ScriptableModule } from './module_runtime.js';
import { MODULE_CATALOG } from './modules_catalog.js';

let audioCtx = null;
let scriptNode = null;
let isPlaying = false;

let quadroChalk = null;

const LINK_AUDIO = 0;
const LINK_MIDI  = 1;
const LINK_VAL   = 2;

const BLOCK_SIZE = 128;
const CANVAS_W = 1320;
const CANVAS_H = 700;

const camera = {
    x: 0,
    y: 0,
    zoom: 1.0
};

// Live Nodes & Modules State
const activeModules = []; // array of ScriptableModule
const activeNodes = [];   // metadata for blackboard rendering
const activeLinks = [];   // [{ srcNode, srcOutIdx, dstNode, type, gain }]

let selectedModuleIdx = 0;

async function loadWasm(url) {
    const res = await fetch(url);
    const bytes = await res.arrayBuffer();
    const mod = await WebAssembly.instantiate(bytes, { env: {} });
    return mod.instance.exports;
}

async function initGraph() {
    console.log('[Brack] Initializing Live-Scriptable Modular Engine...');
    quadroChalk = await loadWasm('../roms/quadro_chalk.wasm');
    quadroChalk.quadro_chalk_init(CANVAS_W, CANVAS_H);

    // Instantiate default preset modules
    createModuleNode('clock', 30, 200);   // 0: CLOCK
    createModuleNode('seq', 300, 200);    // 1: SEQ
    createModuleNode('vco', 570, 60);     // 2: VCO
    createModuleNode('adsr', 570, 370);   // 3: ADSR
    createModuleNode('vcf', 840, 60);     // 4: VCF
    createModuleNode('vca', 840, 370);    // 5: VCA
    createModuleNode('delay', 1110, 200); // 6: DELAY
    createModuleNode('out', 1380, 200);   // 7: OUT

    // Setup Default Links
    // 1. Clock (Gate out 0) -> Seq (Clock in)
    addLink(0, 0, 1, LINK_VAL, 1.0);

    // 2. Clock (Gate out 0) -> ADSR (Gate in)
    addLink(0, 0, 3, LINK_VAL, 1.0);

    // 3. Seq (Pitch out 0) -> VCO (Voct FM in)
    addLink(1, 0, 2, LINK_VAL, 1.0);

    // 4. VCO (Audio out 0) -> VCF (Audio in)
    addLink(2, 0, 4, LINK_AUDIO, 1.0);

    // 5. ADSR (Env out 0) -> VCF (Cutoff CV in)
    addLink(3, 0, 4, LINK_VAL, 2.0);

    // 6. VCF (Audio out 0) -> VCA (Audio in)
    addLink(4, 0, 5, LINK_AUDIO, 1.0);

    // 7. ADSR (Env out 0) -> VCA (Gain CV in)
    addLink(3, 0, 5, LINK_VAL, 1.0);

    // 8. VCA (Audio out 0) -> Delay (Audio in)
    addLink(5, 0, 6, LINK_AUDIO, 1.0);

    // 9. Delay (Audio out 0) -> Out (Master in)
    addLink(6, 0, 7, LINK_AUDIO, 1.0);

    selectModuleForEditing(2);
}

let strPoolOffset = 0;

function writeWasmString(str) {
    if (!str) str = '';
    const poolBase = quadroChalk.quadro_chalk_get_string_pool();
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str + '\0');
    if (strPoolOffset + bytes.length > 64000) strPoolOffset = 0;
    const ptr = poolBase + strPoolOffset;
    new Uint8Array(quadroChalk.memory.buffer).set(bytes, ptr);
    strPoolOffset = (strPoolOffset + bytes.length + 3) & ~3;
    return ptr;
}

function createModuleNode(templateKey, x, y) {
    const tmpl = MODULE_CATALOG[templateKey] || MODULE_CATALOG['vco'];
    const idx = activeModules.length;

    const mod = new ScriptableModule(idx, tmpl.code, 48000);
    activeModules.push(mod);

    const namePtr = writeWasmString(tmpl.name);
    const catPtr  = writeWasmString(tmpl.category);

    // Register text box node in C Quadro Chalkboard
    const chalkNodeId = quadroChalk.quadro_chalk_add_node(
        idx,
        namePtr,
        catPtr,
        tmpl.color,
        x,
        y,
        260,
        180
    );

    // Set code script lines in C chalkboard text box
    const codePtr = writeWasmString(tmpl.code);
    quadroChalk.quadro_chalk_set_node_code(chalkNodeId, codePtr);

    // Register outputs in Chalkboard
    mod.outputDefs.forEach((out) => {
        const outType = (out.type === 'MIDI') ? LINK_MIDI :
                        (out.type === 'VAL')  ? LINK_VAL : LINK_AUDIO;
        const outNamePtr = writeWasmString(out.name);
        quadroChalk.quadro_chalk_add_node_output(chalkNodeId, outType, outNamePtr);
    });

    // Register sliders in Chalkboard
    mod.paramDefs.forEach((p, pIdx) => {
        const defV = p.default !== undefined ? p.default : 0.5;
        const valStr = formatParamStr(defV, p);
        const pNamePtr = writeWasmString(p.name);
        const valStrPtr = writeWasmString(valStr);
        quadroChalk.quadro_chalk_add_slider(chalkNodeId, pIdx, pNamePtr, valStrPtr, defV, p.min, p.max);
    });

    activeNodes.push({
        idx,
        chalkNodeId,
        templateKey,
        name: tmpl.name,
        category: tmpl.category,
        color: tmpl.color
    });

    return idx;
}

function addLink(srcNode, srcOutIdx, dstNode, type, gain = 1.0) {
    activeLinks.push({ srcNode, srcOutIdx, dstNode, type, gain });
    quadroChalk.quadro_chalk_connect(srcNode, srcOutIdx, dstNode, type, gain);
}

function formatParamStr(val, def) {
    if (!def) return val.toFixed(2);
    if (def.unit === 'Hz') return `${Math.round(val)} Hz`;
    if (def.unit === '%') return `${Math.round(val * 100)} %`;
    if (def.unit === 's') return `${Math.round(val * 1000)} ms`;
    if (def.unit === 'x') return `${val.toFixed(1)} x`;
    return val.toFixed(2);
}

function selectModuleForEditing(idx) {
    if (idx < 0 || idx >= activeModules.length) return;
    selectedModuleIdx = idx;
    quadroChalk.quadro_chalk_set_selected_node(idx);

    const mod = activeModules[idx];
    const node = activeNodes[idx];

    const editorTitle = document.getElementById('editor-module-title');
    const editorArea = document.getElementById('code-editor');
    const statusPill = document.getElementById('editor-status-pill');

    editorTitle.textContent = `⚡ Edit [${node.name}] (Slot ${idx})`;
    editorArea.value = mod.code;

    if (mod.error) {
        statusPill.textContent = 'Syntax Error';
        statusPill.className = 'editor-status error';
    } else {
        statusPill.textContent = 'Running';
        statusPill.className = 'editor-status';
    }
}

function applyCurrentCode() {
    const mod = activeModules[selectedModuleIdx];
    const node = activeNodes[selectedModuleIdx];
    const editorArea = document.getElementById('code-editor');
    const statusPill = document.getElementById('editor-status-pill');

    const res = mod.compile(editorArea.value);
    if (res.success) {
        statusPill.textContent = 'Compiled OK';
        statusPill.className = 'editor-status';

        // Update live code in C blackboard text box
        const codePtr = writeWasmString(editorArea.value);
        quadroChalk.quadro_chalk_set_node_code(node.chalkNodeId, codePtr);
    } else {
        statusPill.textContent = res.error;
        statusPill.className = 'editor-status error';
    }
}

/* =========================================================================
 * Real-Time Audio Synthesis Processing Loop
 * ========================================================================= */

async function startAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        const bufferSize = 512;
        scriptNode = audioCtx.createScriptProcessor(bufferSize, 0, 2);

        scriptNode.onaudioprocess = (e) => {
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);

            for (let offset = 0; offset < bufferSize; offset += BLOCK_SIZE) {
                // Execute each scriptable module
                for (let i = 0; i < activeModules.length; i++) {
                    const mod = activeModules[i];

                    // Gather incoming dynamic links for this module
                    const inLinks = [];
                    for (const link of activeLinks) {
                        if (link.dstNode === i) {
                            const srcMod = activeModules[link.srcNode];
                            if (link.type === LINK_AUDIO) {
                                inLinks.push({
                                    type: 'audio',
                                    src: link.srcNode,
                                    gain: link.gain,
                                    audio: srcMod.audioOutputs[link.srcOutIdx]
                                });
                            } else if (link.type === LINK_MIDI) {
                                inLinks.push({
                                    type: 'midi',
                                    src: link.srcNode,
                                    events: srcMod.midiOutputs[link.srcOutIdx]
                                });
                            } else if (link.type === LINK_VAL) {
                                inLinks.push({
                                    type: 'val',
                                    src: link.srcNode,
                                    gain: link.gain,
                                    val: srcMod.valOutputs[link.srcOutIdx] * link.gain
                                });
                            }
                        }
                    }

                    // Run module process (JS script execution with C DSP acceleration)
                    mod.process(inLinks, BLOCK_SIZE);
                }

                // Copy Master Output (Out Module) to Audio Buffer
                const outNodeIdx = activeNodes.findIndex(n => n.templateKey === 'out');
                const outMod = (outNodeIdx >= 0 && activeModules[outNodeIdx]) ? activeModules[outNodeIdx] : activeModules[activeModules.length - 1];

                if (outMod) {
                    const finalL = outMod.audioOutputs[0];
                    const finalR = outMod.audioOutputs[1] || outMod.audioOutputs[0];

                    for (let s = 0; s < BLOCK_SIZE; s++) {
                        outL[offset + s] = finalL[s];
                        outR[offset + s] = finalR[s];
                    }
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
 * UI Interaction & 60 FPS Blackboard Render Loop
 * ========================================================================= */

window.addEventListener('DOMContentLoaded', async () => {
    await initGraph();

    const canvas = document.getElementById('chalk-canvas');
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(CANVAS_W, CANVAS_H);
    const zoomLabel = document.getElementById('zoom-label');
    const workspaceGrid = document.getElementById('workspace-grid');

    function updateZoomLabel() {
        zoomLabel.textContent = `🔍 ${Math.round(camera.zoom * 100)}%`;
        quadroChalk.quadro_chalk_set_camera(camera.x, camera.y, camera.zoom);
    }

    // Zoom on Mouse Wheel
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
        const mouseY = (e.clientY - rect.top) * (CANVAS_H / rect.height);

        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(0.4, Math.min(2.5, camera.zoom * zoomFactor));

        camera.x = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
        camera.y = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);
        camera.zoom = newZoom;

        updateZoomLabel();
    }, { passive: false });

    document.getElementById('btn-reset-view').addEventListener('click', () => {
        camera.x = 0;
        camera.y = 0;
        camera.zoom = 1.0;
        updateZoomLabel();
    });

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

    // Toggle Code Editor
    const btnToggleEditor = document.getElementById('btn-toggle-editor');
    btnToggleEditor.addEventListener('click', () => {
        workspaceGrid.classList.toggle('editor-open');
        btnToggleEditor.classList.toggle('active');
    });

    // Apply Code (Hot Reload)
    document.getElementById('btn-apply-code').addEventListener('click', applyCurrentCode);
    document.getElementById('code-editor').addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            applyCurrentCode();
        }
    });

    // Add Module Dropdown
    document.getElementById('select-add-module').addEventListener('change', (e) => {
        const tmplKey = e.target.value;
        if (tmplKey) {
            const posX = 100 + (activeModules.length % 4) * 230;
            const posY = 100 + Math.floor(activeModules.length / 4) * 220;
            const newId = createModuleNode(tmplKey, posX, posY);
            selectModuleForEditing(newId);
            workspaceGrid.classList.add('editor-open');
            btnToggleEditor.classList.add('active');
            e.target.value = '';
        }
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        quadroChalk.quadro_chalk_clear();
        activeLinks.length = 0;
    });

    function getCanvasPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
            y: (e.clientY - rect.top) * (CANVAS_H / rect.height)
        };
    }

    let isMouseDown = false;

    canvas.addEventListener('mousedown', (e) => {
        const pos = getCanvasPos(e);
        quadroChalk.quadro_chalk_mouse_down(pos.x, pos.y, e.button);
        isMouseDown = true;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const pos = getCanvasPos(e);

        const ptrSlot = 1024;
        const ptrParam = 1028;
        const ptrVal = 1032;

        const sliderChanged = quadroChalk.quadro_chalk_mouse_move(pos.x, pos.y, ptrSlot, ptrParam, ptrVal);
        if (sliderChanged) {
            const i32 = new Int32Array(quadroChalk.memory.buffer);
            const f32 = new Float32Array(quadroChalk.memory.buffer);
            const slotId  = i32[ptrSlot >> 2];
            const paramId = i32[ptrParam >> 2];
            const val     = f32[ptrVal >> 2];

            if (slotId >= 0 && slotId < activeModules.length) {
                const mod = activeModules[slotId];
                mod.setParam(paramId, val);
                const pDef = mod.paramDefs[paramId];
                const str = formatParamStr(val, pDef);
                quadroChalk.quadro_chalk_update_slider_str(slotId, paramId, str);
            }
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;
        const pos = getCanvasPos(e);

        const ptrSrcSlot = 1024;
        const ptrSrcOut  = 1028;
        const ptrDstSlot = 1032;
        const ptrLinkType= 1036;
        const connected = quadroChalk.quadro_chalk_mouse_up(pos.x, pos.y, ptrSrcSlot, ptrSrcOut, ptrDstSlot, ptrLinkType);

        if (connected) {
            const i32 = new Int32Array(quadroChalk.memory.buffer);
            const srcSlot = i32[ptrSrcSlot >> 2];
            const srcOut  = i32[ptrSrcOut >> 2];
            const dstSlot = i32[ptrDstSlot >> 2];
            const linkType= i32[ptrLinkType >> 2];
            const gain = (srcSlot === 1 && dstSlot === 2) ? 2.5 : 1.0;
            activeLinks.push({ srcNode: srcSlot, srcOutIdx: srcOut, dstNode: dstSlot, type: linkType, gain });
        }
        
        // Sync selected module text box with editor
        const selectedId = quadroChalk.quadro_chalk_get_selected_node();
        if (selectedId >= 0 && selectedId < activeModules.length) {
            selectModuleForEditing(selectedId);
        }
        isMouseDown = false;
    });

    canvas.addEventListener('dblclick', () => {
        workspaceGrid.classList.add('editor-open');
        btnToggleEditor.classList.add('active');
        document.getElementById('code-editor').focus();
    });

    // 60 FPS Render Loop (100% C Quadro Blackboard Engine)
    function renderLoop() {
        requestAnimationFrame(renderLoop);

        // Feed live waveforms into mini-displays of each chalk node in C
        if (isPlaying && activeModules.length > 0) {
            for (let i = 0; i < activeModules.length; i++) {
                const mod = activeModules[i];
                const audioOut = mod.audioOutputs[0];

                const scopePtr = 4096 + 32 * 128 * 4;
                const qc = new Float32Array(quadroChalk.memory.buffer);
                for (let s = 0; s < 48; s++) {
                    qc[(scopePtr >> 2) + s] = audioOut[s * 2];
                }
                quadroChalk.quadro_chalk_feed_scope(i, scopePtr, 48);
            }
        }

        // Render full chalkboard in C via Quadro
        quadroChalk.quadro_chalk_render();

        // Blit C framebuffer to Canvas
        const fbPtr = quadroChalk.quadro_chalk_get_framebuffer();
        const fbBytes = new Uint8ClampedArray(quadroChalk.memory.buffer, fbPtr, CANVAS_W * CANVAS_H * 4);

        imgData.data.set(fbBytes);
        ctx.putImageData(imgData, 0, 0);
    }

    renderLoop();
});


