/**
 * =========================================================================
 * BRACK Scratch Modular Synth Engine (web/app.js)
 * Scratch-Themed Controls, Snap Sound FX, and C/WASM 48kHz Real-Time DSP
 * =========================================================================
 */

import { registerSynthBlocks } from './synth_blocks.js';
import { BlocklySynthEngine } from './blockly_dsp_compiler.js';

let audioCtx = null;
let scriptNode = null;
let isPlaying = false;
let synthEngine = null;
let workspace = null;

const BLOCK_SIZE = 128;

/* =========================================================================
 * Scratch Snap Pop Sound Synthesizer (Web Audio FX)
 * ========================================================================= */

function playScratchSnapSound() {
    try {
        if (!audioCtx || audioCtx.state !== 'running') return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        const now = audioCtx.currentTime;
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.045);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.05);
    } catch (e) {
        // Ignored
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
                if (synthEngine && isPlaying) {
                    synthEngine.processBlock(outL, outR, offset, BLOCK_SIZE);
                } else {
                    for (let s = 0; s < BLOCK_SIZE; s++) {
                        outL[offset + s] = 0;
                        outR[offset + s] = 0;
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
 * Default Scratch Modular Patch Builder
 * ========================================================================= */

function loadDefaultPatch() {
    if (!workspace) return;
    workspace.clear();

    // 1. Column 1: Modulators & Broadcast Senders (Left)
    // Clock -> Transmit [clock_mestre]
    const clockBlock = workspace.newBlock('synth_clock');
    clockBlock.initSvg();
    clockBlock.render();
    clockBlock.moveTo(new Blockly.utils.Coordinate(-460, -280));

    const sendClk = workspace.newBlock('synth_send');
    sendClk.setFieldValue('clock_mestre', 'CHANNEL');
    sendClk.initSvg();
    sendClk.render();
    clockBlock.nextConnection.connect(sendClk.previousConnection);

    // Sequencer (CLK receives clock_mestre) -> Transmit [pitch_seq]
    const seqBlock = workspace.newBlock('synth_seq');
    seqBlock.initSvg();
    seqBlock.render();
    seqBlock.moveTo(new Blockly.utils.Coordinate(-460, -80));

    const recvClk1 = workspace.newBlock('synth_recv');
    recvClk1.setFieldValue('clock_mestre', 'CHANNEL');
    recvClk1.initSvg();
    recvClk1.render();
    seqBlock.getInput('CLK').connection.connect(recvClk1.outputConnection);

    // Build chainable note sequence: C ➔ Eb ➔ G ➔ Bb ➔ C(+1) ➔ Bb ➔ G ➔ Eb
    const notesData = [
        { note: "0", oct: 0 },
        { note: "3", oct: 0 },
        { note: "7", oct: 0 },
        { note: "10", oct: 0 },
        { note: "0", oct: 1 },
        { note: "10", oct: 0 },
        { note: "7", oct: 0 },
        { note: "3", oct: 0 }
    ];

    let prevNoteBlock = null;
    for (let i = 0; i < notesData.length; i++) {
        const noteBlock = workspace.newBlock('seq_note');
        noteBlock.setFieldValue(notesData[i].note, 'NOTE');
        noteBlock.setFieldValue(notesData[i].oct, 'OCTAVE');
        noteBlock.initSvg();
        noteBlock.render();

        if (i === 0) {
            seqBlock.getInput('STEPS').connection.connect(noteBlock.previousConnection);
        } else if (prevNoteBlock) {
            prevNoteBlock.nextConnection.connect(noteBlock.previousConnection);
        }
        prevNoteBlock = noteBlock;
    }

    const sendPitch = workspace.newBlock('synth_send');
    sendPitch.setFieldValue('pitch_seq', 'CHANNEL');
    sendPitch.initSvg();
    sendPitch.render();
    sendPitch.moveTo(new Blockly.utils.Coordinate(-180, -80));
    sendPitch.getInput('IN').connection.connect(seqBlock.outputConnection);

    // ADSR Envelope (GATE receives clock_mestre) -> Transmit [envelope_adsr]
    const adsrBlock = workspace.newBlock('synth_adsr');
    adsrBlock.initSvg();
    adsrBlock.render();
    adsrBlock.moveTo(new Blockly.utils.Coordinate(-460, 260));

    const recvClk2 = workspace.newBlock('synth_recv');
    recvClk2.setFieldValue('clock_mestre', 'CHANNEL');
    recvClk2.initSvg();
    recvClk2.render();
    adsrBlock.getInput('GATE').connection.connect(recvClk2.outputConnection);

    const sendEnv = workspace.newBlock('synth_send');
    sendEnv.setFieldValue('envelope_adsr', 'CHANNEL');
    sendEnv.initSvg();
    sendEnv.render();
    sendEnv.moveTo(new Blockly.utils.Coordinate(-180, 260));
    sendEnv.getInput('IN').connection.connect(adsrBlock.outputConnection);

    // 2. Column 2: Scratch Audio Rack Stack (Right)
    const flagBlock = workspace.newBlock('event_whenflagclicked');
    flagBlock.initSvg();
    flagBlock.render();
    flagBlock.moveTo(new Blockly.utils.Coordinate(100, -280));

    const vcoBlock = workspace.newBlock('synth_vco');
    vcoBlock.initSvg();
    vcoBlock.render();

    const recvPitch = workspace.newBlock('synth_recv');
    recvPitch.setFieldValue('pitch_seq', 'CHANNEL');
    recvPitch.initSvg();
    recvPitch.render();
    vcoBlock.getInput('FM').connection.connect(recvPitch.outputConnection);

    const vcfBlock = workspace.newBlock('synth_vcf');
    vcfBlock.initSvg();
    vcfBlock.render();

    // Map ADSR envelope (0..1) to Moog cutoff (250..7000 Hz) using math_map
    const mapCutoff = workspace.newBlock('math_map');
    mapCutoff.setFieldValue(0, 'IN_MIN');
    mapCutoff.setFieldValue(1, 'IN_MAX');
    mapCutoff.setFieldValue(250, 'OUT_MIN');
    mapCutoff.setFieldValue(7000, 'OUT_MAX');
    mapCutoff.initSvg();
    mapCutoff.render();

    const recvEnv1 = workspace.newBlock('synth_recv');
    recvEnv1.setFieldValue('envelope_adsr', 'CHANNEL');
    recvEnv1.initSvg();
    recvEnv1.render();
    mapCutoff.getInput('VAL').connection.connect(recvEnv1.outputConnection);
    vcfBlock.getInput('CUTOFF').connection.connect(mapCutoff.outputConnection);

    const vcaBlock = workspace.newBlock('synth_vca');
    vcaBlock.initSvg();
    vcaBlock.render();

    const recvEnv2 = workspace.newBlock('synth_recv');
    recvEnv2.setFieldValue('envelope_adsr', 'CHANNEL');
    recvEnv2.initSvg();
    recvEnv2.render();
    vcaBlock.getInput('GAIN').connection.connect(recvEnv2.outputConnection);

    const scopeBlock = workspace.newBlock('synth_scope');
    scopeBlock.initSvg();
    scopeBlock.render();

    const delayBlock = workspace.newBlock('synth_delay');
    delayBlock.initSvg();
    delayBlock.render();

    const outBlock = workspace.newBlock('synth_out');
    outBlock.initSvg();
    outBlock.render();

    // Snap Vertical Scratch Audio Stack: Flag ➔ VCO ➔ VCF ➔ VCA ➔ Scope ➔ Delay ➔ Out
    flagBlock.nextConnection.connect(vcoBlock.previousConnection);
    vcoBlock.nextConnection.connect(vcfBlock.previousConnection);
    vcfBlock.nextConnection.connect(vcaBlock.previousConnection);
    vcaBlock.nextConnection.connect(scopeBlock.previousConnection);
    scopeBlock.nextConnection.connect(delayBlock.previousConnection);
    delayBlock.nextConnection.connect(outBlock.previousConnection);

    workspace.scrollCenter();
    synthEngine.compile();
}

/* =========================================================================
 * Application Initialization
 * ========================================================================= */

window.addEventListener('DOMContentLoaded', () => {
    // 1. Register Scratch Synth Blocks
    registerSynthBlocks(Blockly);

    // 2. Define Dark Scratch Theme for Blockly
    const scratchTheme = Blockly.Theme.defineTheme('scratchTheme', {
        base: Blockly.Themes.Classic,
        blockStyles: {
            hat_blocks: {
                colourPrimary: "#FFAB19",
                colourSecondary: "#E69900",
                colourTertiary: "#CC8800"
            }
        },
        componentStyles: {
            workspaceBackgroundColour: '#0c100e',
            toolboxBackgroundColour: '#16201c',
            toolboxForegroundColour: '#dcdde1',
            flyoutBackgroundColour: '#111714',
            flyoutOpacity: 0.95,
            scrollbarColour: '#283731',
            scrollbarOpacity: 0.6,
            insertionMarkerColour: '#55efc4',
            insertionMarkerOpacity: 0.85
        }
    });

    // 3. Inject Blockly Workspace
    workspace = Blockly.inject('blockly-div', {
        toolbox: document.getElementById('toolbox'),
        grid: {
            spacing: 25,
            length: 3,
            colour: '#22302a',
            snap: true
        },
        zoom: {
            controls: true,
            wheel: true,
            startScale: 0.85,
            maxScale: 2.0,
            minScale: 0.4,
            scaleSpeed: 1.1
        },
        trashcan: true,
        theme: scratchTheme
    });

    // 4. Initialize Real-Time DSP Engine
    synthEngine = new BlocklySynthEngine(48000);
    synthEngine.setWorkspace(workspace);

    // Re-compile audio graph & play snap sound on block connections
    workspace.addChangeListener((e) => {
        if (e.isUiEvent) return;

        // Play Scratch snap pop when block connects
        if (e.type === Blockly.Events.BLOCK_MOVE && e.newParentId && !e.oldParentId) {
            playScratchSnapSound();
        }

        synthEngine.compile();
    });

    // 5. Load Default Scratch Modular Preset
    loadDefaultPatch();

    // 6. Scratch Header Controls (Green Flag 🚩 / Red Stop 🛑)
    const btnFlag = document.getElementById('btn-flag');
    const btnStop = document.getElementById('btn-stop');
    const statusLabel = document.getElementById('status-label');

    btnFlag.addEventListener('click', async () => {
        await startAudio();
        isPlaying = true;
        btnFlag.classList.add('running');
        statusLabel.textContent = '🔊 Sintetizando';
        statusLabel.style.color = '#55efc4';
    });

    btnStop.addEventListener('click', async () => {
        isPlaying = false;
        btnFlag.classList.remove('running');
        statusLabel.textContent = '🛑 Parado';
        statusLabel.style.color = '#ff7675';
    });

    document.getElementById('btn-preset-default').addEventListener('click', loadDefaultPatch);
    document.getElementById('btn-clear-workspace').addEventListener('click', () => {
        workspace.clear();
        synthEngine.compile();
    });

    // Keyboard Event Listener for `event_whenkeypressed`
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (synthEngine) synthEngine.onKeyDown(e.code);
    });

    window.addEventListener('keyup', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (synthEngine) synthEngine.onKeyUp(e.code);
    });

    // 7. Live 60 FPS Oscilloscope Display Render Loop
    function renderLiveOscilloscopes() {
        if (workspace && synthEngine) {
            const scopeBlocks = workspace.getAllBlocks(false).filter(b => b.type === 'synth_scope');

            for (const block of scopeBlocks) {
                const fieldImg = block.getField('SCOPE_IMG');
                if (!fieldImg) continue;
                const fieldSvgRoot = fieldImg.getSvgRoot();
                if (!fieldSvgRoot) continue;
                const parentGroup = fieldSvgRoot.parentNode;
                if (!parentGroup) continue;

                // Hide the raw image placeholder
                fieldSvgRoot.style.display = 'none';

                // Calculate exact offset inside the block
                let posX = 16;
                let posY = 64;
                try {
                    const bbox = fieldSvgRoot.getBBox ? fieldSvgRoot.getBBox() : null;
                    if (bbox && bbox.y > 10) {
                        posX = bbox.x;
                        posY = bbox.y;
                    }
                } catch (e) {
                    // getBBox fallback
                }

                let scopeGroup = parentGroup.querySelector('.blockly-scope-display');
                if (!scopeGroup) {
                    scopeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    scopeGroup.setAttribute('class', 'blockly-scope-display');
                    scopeGroup.setAttribute('transform', `translate(${posX}, ${posY})`);

                    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    bgRect.setAttribute('x', '0');
                    bgRect.setAttribute('y', '0');
                    bgRect.setAttribute('width', '180');
                    bgRect.setAttribute('height', '60');
                    bgRect.setAttribute('rx', '4');
                    bgRect.setAttribute('fill', '#060a08');
                    bgRect.setAttribute('stroke', '#1f3329');
                    bgRect.setAttribute('stroke-width', '1.5');

                    const centerLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    centerLine.setAttribute('x1', '0');
                    centerLine.setAttribute('y1', '30');
                    centerLine.setAttribute('x2', '180');
                    centerLine.setAttribute('y2', '30');
                    centerLine.setAttribute('stroke', '#121f18');
                    centerLine.setAttribute('stroke-dasharray', '3,3');

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('class', 'scope-waveform');
                    path.setAttribute('d', 'M 0 30 L 180 30');
                    path.setAttribute('stroke', '#55efc4');
                    path.setAttribute('stroke-width', '2');
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke-linecap', 'round');
                    path.setAttribute('stroke-linejoin', 'round');

                    scopeGroup.appendChild(bgRect);
                    scopeGroup.appendChild(centerLine);
                    scopeGroup.appendChild(path);
                    parentGroup.appendChild(scopeGroup);
                } else {
                    scopeGroup.setAttribute('transform', `translate(${posX}, ${posY})`);
                }

                const state = synthEngine.blockStates.get(block.id);
                const pathEl = scopeGroup.querySelector('.scope-waveform');
                if (!pathEl) continue;

                if (isPlaying && state && state.history) {
                    const hist = state.history;
                    const head = state.histHead;
                    const len = 512;

                    // Trigger zero-crossing
                    let start = (head - 256 + len) % len;
                    for (let i = 0; i < 96; i++) {
                        const idx1 = (head - 256 + i + len) % len;
                        const idx2 = (idx1 + 1) % len;
                        if (hist[idx1] <= 0 && hist[idx2] > 0) {
                            start = idx2;
                            break;
                        }
                    }

                    const width = 180;
                    const midY = 30;
                    const samplesToShow = 256;
                    const points = [];

                    for (let x = 0; x < width; x += 2) {
                        const idx = (start + Math.floor(x * (samplesToShow / width))) % len;
                        const smp = Math.max(-1.1, Math.min(1.1, hist[idx] || 0));
                        const y = midY - smp * (midY - 4);
                        points.push(`${x},${y.toFixed(1)}`);
                    }

                    pathEl.setAttribute('d', 'M ' + points.join(' L '));
                } else {
                    pathEl.setAttribute('d', 'M 0 30 L 180 30');
                }
            }
        }
        requestAnimationFrame(renderLiveOscilloscopes);
    }

    renderLiveOscilloscopes();
});

