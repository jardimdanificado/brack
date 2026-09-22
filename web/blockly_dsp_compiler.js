/**
 * =========================================================================
 * BRACK Unified Real-Time 48kHz DSP Graph Engine (web/blockly_dsp_compiler.js)
 * Executes Unified Modules, Free-Text Buses, Event Triggers, Chained Sequencers,
 * Full List Manipulations & Audio-Rate Math Operators
 * =========================================================================
 */

import { MODULE_REGISTRY, dspHelpers as dsp } from './synth_registry.js';

export class BlocklySynthEngine {
    constructor(sampleRate = 48000) {
        this.sampleRate = sampleRate;
        this.workspace = null;

        // Dynamic State Tables
        this.blockStates = new Map();
        this.sendBlocksByChannel = new Map();
        this.broadcastListeners = new Map();
        this.activeBroadcasts = new Set();
        this.pressedKeys = new Set();
        this.hatBlocks = [];
        this.busCache = new Map();
        this.variables = new Map();
        this.lists = new Map();
        this.outBlock = null;

        // Module Box IO & Knob mapping for Rack Engine
        this.inputSignals = new Map();
        this.outputSignals = new Map();
        this.knobValues = new Map();
        this.moduleOutputBlocks = [];
        this.moduleProcessBlocks = [];
    }

    setWorkspace(workspace) {
        this.workspace = workspace;
        this.compile();
    }

    onKeyDown(code) {
        this.pressedKeys.add(code);
        this.pressedKeys.add('any');
    }

    onKeyUp(code) {
        this.pressedKeys.delete(code);
        if (this.pressedKeys.size === 1 && this.pressedKeys.has('any')) {
            this.pressedKeys.delete('any');
        }
    }

    compile() {
        if (!this.workspace) return;

        const allBlocks = this.workspace.getAllBlocks(false);
        this.outBlock = allBlocks.find(b => b.type === 'synth_out') || null;

        this.sendBlocksByChannel.clear();
        this.broadcastListeners.clear();
        this.hatBlocks = [];
        this.moduleOutputBlocks = [];
        this.moduleProcessBlocks = [];

        for (const block of allBlocks) {
            if (!this.blockStates.has(block.id)) {
                this.blockStates.set(block.id, this.initBlockState(block.type));
            }

            if (block.type === 'module_io_output') {
                this.moduleOutputBlocks.push(block);
            }
            if (block.type === 'module_io_process') {
                this.moduleProcessBlocks.push(block);
            }

            if (block.type.startsWith('event_')) {
                this.hatBlocks.push(block);
                if (block.type === 'event_whenbroadcastreceived') {
                    const evt = block.getFieldValue('EVENT') || 'virada';
                    if (!this.broadcastListeners.has(evt)) {
                        this.broadcastListeners.set(evt, []);
                    }
                    this.broadcastListeners.get(evt).push(block);
                }
            }

            if (block.type === 'synth_send') {
                const ch = block.getFieldValue('CHANNEL') || 'meu_sinal';
                if (!this.sendBlocksByChannel.has(ch)) {
                    this.sendBlocksByChannel.set(ch, []);
                }
                this.sendBlocksByChannel.get(ch).push(block);
            }
        }

        const activeIds = new Set(allBlocks.map(b => b.id));
        for (const id of this.blockStates.keys()) {
            if (!activeIds.has(id)) this.blockStates.delete(id);
        }

        // Execute initial setup / flag hat blocks
        for (const hat of this.hatBlocks) {
            if (hat.type === 'event_whenflagclicked') {
                const next = hat.getNextBlock ? hat.getNextBlock() : null;
                if (next) this.evalBlock(next);
            }
        }
    }

    initBlockState(type) {
        const unified = MODULE_REGISTRY.get(type);
        if (unified && unified.state) {
            return unified.state();
        }

        switch (type) {
            case 'event_every':
                return { samplesRemaining: 0 };
            case 'event_whencondition':
                return { lastVal: 0 };
            case 'event_whenkeypressed':
                return { wasPressed: false };
            case 'synth_seq':
                return { step: 0, last: 0, voct: 0, gate: 0, audioBuf: new Float32Array(128) };
            case 'math_arithmetic':
            case 'math_map':
            case 'math_single':
            case 'math_note_to_hz':
            case 'logic_compare_cv':
            default:
                return { audioBuf: new Float32Array(128) };
        }
    }

    getAudioSource(block, inputName = 'IN', visited = new Set()) {
        const valueTarget = block.getInputTargetBlock ? block.getInputTargetBlock(inputName) : null;
        if (valueTarget) {
            return this.evalBlock(valueTarget, visited);
        }
        const prevBlock = block.getPreviousBlock ? block.getPreviousBlock() : null;
        if (prevBlock) {
            return this.evalBlock(prevBlock, visited);
        }
        return null;
    }

    getParamVal(block, inputName, defaultVal, visited = new Set()) {
        const target = block.getInputTargetBlock ? block.getInputTargetBlock(inputName) : null;
        if (target) {
            return this.evalBlock(target, visited);
        }
        const field = block.getFieldValue ? block.getFieldValue(inputName) : null;
        if (field !== null && field !== undefined) {
            const num = Number(field);
            return { type: 'VAL', val: isNaN(num) ? defaultVal : num, audio: null };
        }
        return { type: 'VAL', val: defaultVal, audio: null };
    }

    evalBlock(block, visited = new Set()) {
        if (!block || visited.has(block.id)) return { type: 'VAL', val: 0, audio: null };
        visited.add(block.id);

        const state = this.blockStates.get(block.id) || this.initBlockState(block.type);
        const numSamples = 128;

        // 1. Check Unified Module Registry
        const unified = MODULE_REGISTRY.get(block.type);
        if (unified && unified.process) {
            const inputs = {};
            for (const inp of unified.inputs) {
                if (inp.type === 'dropdown' || inp.type === 'text') {
                    inputs[inp.id] = block.getFieldValue(inp.id) || inp.default;
                } else if (inp.type === 'audio') {
                    inputs[inp.id] = this.getAudioSource(block, inp.id, new Set(visited));
                } else {
                    inputs[inp.id] = this.getParamVal(block, inp.id, inp.default, new Set(visited));
                }
            }
            return unified.process(inputs, state, dsp, numSamples);
        }

        // 2. Specialized Block Logic (Routing, Lists, Sequencer, Logic, Events, Module IO)
        switch (block.type) {
            // Module Box IO & Knob
            case 'module_io_input': {
                const portName = block.getFieldValue('PORT') || 'In';
                const sig = this.inputSignals.get(portName);
                if (sig) {
                    return sig;
                }
                const silentBuf = new Float32Array(numSamples);
                return { type: 'AUDIO', val: 0, audio: silentBuf };
            }

            case 'module_io_output': {
                const portName = block.getFieldValue('PORT') || 'Out';
                const sigRes = this.getAudioSource(block, 'SIGNAL', new Set(visited)) || this.getParamVal(block, 'SIGNAL', 0, new Set(visited));
                if (sigRes) {
                    this.outputSignals.set(portName, sigRes);
                }
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return sigRes || { type: 'VAL', val: 0, audio: null };
            }

            case 'module_io_knob':
            case 'module_io_slider':
            case 'module_io_switch':
            case 'module_io_button': {
                const paramName = block.getFieldValue('NAME') || 'Cutoff';
                if (this.knobValues && this.knobValues.has(paramName)) {
                    const val = this.knobValues.get(paramName);
                    return { type: 'VAL', val: Number(val), audio: null };
                }
                const defVal = Number(block.getFieldValue('DEFAULT')) || 0;
                return { type: 'VAL', val: defVal, audio: null };
            }

            case 'module_io_xy': {
                const padName = block.getFieldValue('NAME') || 'Joy';
                const axis = block.getFieldValue('AXIS') || 'X';
                const key = `${padName}_${axis}`;
                if (this.knobValues && this.knobValues.has(key)) {
                    const val = this.knobValues.get(key);
                    return { type: 'VAL', val: Number(val), audio: null };
                }
                return { type: 'VAL', val: 0.5, audio: null };
            }

            case 'module_io_wavedraw': {
                const waveName = block.getFieldValue('NAME') || 'Wave';
                const idxRes = this.getParamVal(block, 'INDEX', 0, new Set(visited));
                const idx = Math.floor(Math.max(0, Math.min(127, idxRes.val)));
                if (this.knobValues && this.knobValues.has(waveName)) {
                    const waveTable = this.knobValues.get(waveName);
                    if (Array.isArray(waveTable) || waveTable instanceof Float32Array) {
                        return { type: 'VAL', val: Number(waveTable[idx] || 0), audio: null };
                    }
                }
                // Default sine table lookup
                return { type: 'VAL', val: Math.sin(idx / 128 * 2 * Math.PI), audio: null };
            }

            case 'module_io_process':
            case 'module_io_setup':
            case 'module_io_label':
            case 'module_io_separator':
            case 'module_visor_adsr': {
                const nextBlock = block.getNextBlock ? block.getNextBlock() : null;
                if (nextBlock) {
                    return this.evalBlock(nextBlock, visited);
                }
                return { type: 'VAL', val: 0, audio: null };
            }

            case 'module_visor_scope':
            case 'module_visor_vu':
            case 'module_visor_led': {
                const sigRes = this.getAudioSource(block, 'SIGNAL', new Set(visited)) || this.getParamVal(block, 'SIGNAL', 0, new Set(visited));
                const nextBlock = block.getNextBlock ? block.getNextBlock() : null;
                if (nextBlock) this.evalBlock(nextBlock, visited);
                return sigRes || { type: 'VAL', val: 0, audio: null };
            }

            case 'module_visor_display': {
                const valRes = this.getParamVal(block, 'VAL', 0, new Set(visited));
                const nextBlock = block.getNextBlock ? block.getNextBlock() : null;
                if (nextBlock) this.evalBlock(nextBlock, visited);
                return valRes;
            }

            // Free-Text Broadcast Send Block
            case 'synth_send': {
                const ch = block.getFieldValue('CHANNEL') || 'bus_a';
                const src = this.getAudioSource(block, 'IN', new Set(visited)) || this.getParamVal(block, 'IN', 0, new Set(visited));
                if (src) {
                    this.busCache.set(ch, src);
                }
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return src || { type: 'VAL', val: 0, audio: null };
            }

            // Free-Text Broadcast Receive Pill
            case 'synth_recv': {
                const ch = block.getFieldValue('CHANNEL') || 'meu_sinal';
                if (this.busCache.has(ch)) {
                    return this.busCache.get(ch);
                }

                const senders = this.sendBlocksByChannel.get(ch) || [];
                if (senders.length === 0) {
                    const silent = { type: 'VAL', val: 0, audio: null };
                    this.busCache.set(ch, silent);
                    return silent;
                }

                const sumBuf = new Float32Array(numSamples);
                let isAudio = false;
                let scalarSum = 0;

                for (const sendBlock of senders) {
                    const sendRes = this.evalBlock(sendBlock, new Set(visited));
                    if (!sendRes) continue;

                    if (sendRes.audio) {
                        isAudio = true;
                        for (let s = 0; s < numSamples; s++) sumBuf[s] += sendRes.audio[s];
                    } else if (sendRes.val !== undefined) {
                        scalarSum += sendRes.val;
                        for (let s = 0; s < numSamples; s++) sumBuf[s] += sendRes.val;
                    }
                }

                const result = isAudio ? { type: 'AUDIO', val: sumBuf[0], audio: sumBuf } : { type: 'VAL', val: scalarSum, audio: null };
                this.busCache.set(ch, result);
                return result;
            }

            // Variables
            case 'synth_var_set': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const valRes = this.getParamVal(block, 'VAL', 0, new Set(visited));
                this.variables.set(varName, valRes);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return valRes;
            }

            case 'synth_var_change': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const deltaRes = this.getParamVal(block, 'DELTA', 1, new Set(visited));
                const current = this.variables.get(varName) || { type: 'VAL', val: 0, audio: null };
                const newVal = (current.val || 0) + (deltaRes.val || 0);
                const updated = { type: 'VAL', val: newVal, audio: null };
                this.variables.set(varName, updated);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return updated;
            }

            case 'synth_var_mult': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const factorRes = this.getParamVal(block, 'FACTOR', 1, new Set(visited));
                const current = this.variables.get(varName) || { type: 'VAL', val: 0, audio: null };
                const newVal = (current.val || 0) * (factorRes.val !== undefined ? factorRes.val : 1);
                const updated = { type: 'VAL', val: newVal, audio: null };
                this.variables.set(varName, updated);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return updated;
            }

            case 'synth_var_reset': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const zeroVal = { type: 'VAL', val: 0, audio: null };
                this.variables.set(varName, zeroVal);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return zeroVal;
            }

            case 'synth_var_get': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                return this.variables.get(varName) || { type: 'VAL', val: 0, audio: null };
            }

            // List Operations
            case 'synth_list_set': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const itemsStr = block.getFieldValue('ITEMS') || '0';
                const tokens = itemsStr.split(/[,\s]+/).filter(Boolean);
                const items = tokens.map(t => dsp.parseNoteToMidi(t));
                this.lists.set(listName, items);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return { type: 'VAL', val: items.length, audio: null };
            }

            case 'synth_list_add': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const itemRes = this.getParamVal(block, 'ITEM', 0, new Set(visited));
                const val = (typeof itemRes.val === 'string') ? dsp.parseNoteToMidi(itemRes.val) : itemRes.val;
                if (!this.lists.has(listName)) this.lists.set(listName, []);
                this.lists.get(listName).push(val);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return { type: 'VAL', val: val, audio: null };
            }

            case 'synth_list_remove': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const idxRes = this.getParamVal(block, 'INDEX', 0, new Set(visited));
                if (this.lists.has(listName)) {
                    const list = this.lists.get(listName);
                    const idx = Math.floor(Math.abs(idxRes.val || 0));
                    if (list.length > 0) {
                        list.splice(idx % list.length, 1);
                    }
                }
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return { type: 'VAL', val: 1, audio: null };
            }

            case 'synth_list_insert': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const itemRes = this.getParamVal(block, 'ITEM', 0, new Set(visited));
                const idxRes = this.getParamVal(block, 'INDEX', 0, new Set(visited));
                const val = (typeof itemRes.val === 'string') ? dsp.parseNoteToMidi(itemRes.val) : itemRes.val;
                if (!this.lists.has(listName)) this.lists.set(listName, []);
                const list = this.lists.get(listName);
                const idx = Math.min(list.length, Math.max(0, Math.floor(idxRes.val || 0)));
                list.splice(idx, 0, val);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return { type: 'VAL', val: val, audio: null };
            }

            case 'synth_list_replace': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const idxRes = this.getParamVal(block, 'INDEX', 0, new Set(visited));
                const itemRes = this.getParamVal(block, 'ITEM', 0, new Set(visited));
                const val = (typeof itemRes.val === 'string') ? dsp.parseNoteToMidi(itemRes.val) : itemRes.val;
                if (!this.lists.has(listName)) this.lists.set(listName, []);
                const list = this.lists.get(listName);
                if (list.length > 0) {
                    const idx = Math.floor(Math.abs(idxRes.val || 0)) % list.length;
                    list[idx] = val;
                }
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return { type: 'VAL', val: val, audio: null };
            }

            case 'synth_list_clear': {
                const listName = block.getFieldValue('LIST') || 'notas';
                this.lists.set(listName, []);
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return { type: 'VAL', val: 0, audio: null };
            }

            case 'synth_list_get_item': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const idxRes = this.getParamVal(block, 'INDEX', 0, new Set(visited));
                const list = this.lists.get(listName) || [0];
                const len = list.length > 0 ? list.length : 1;
                const safeList = list.length > 0 ? list : [0];

                const hasAudio = !!idxRes.audio;
                for (let s = 0; s < numSamples; s++) {
                    const rawIdx = idxRes.audio ? idxRes.audio[s] : idxRes.val;
                    const cleanIdx = Math.floor(Math.abs(rawIdx)) % len;
                    state.audioBuf[s] = safeList[cleanIdx];
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'synth_list_length': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const list = this.lists.get(listName) || [];
                return { type: 'VAL', val: list.length, audio: null };
            }

            case 'synth_list_contains': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const itemRes = this.getParamVal(block, 'ITEM', 0, new Set(visited));
                const list = this.lists.get(listName) || [];
                const target = itemRes.val;
                const found = list.some(x => Math.abs(x - target) < 0.001) ? 1 : 0;
                return { type: 'VAL', val: found, audio: null };
            }

            case 'synth_list_find': {
                const listName = block.getFieldValue('LIST') || 'notas';
                const itemRes = this.getParamVal(block, 'ITEM', 0, new Set(visited));
                const list = this.lists.get(listName) || [];
                const target = itemRes.val;
                const idx = list.findIndex(x => Math.abs(x - target) < 0.001);
                return { type: 'VAL', val: idx >= 0 ? idx : -1, audio: null };
            }

            // Events
            case 'event_broadcast': {
                const evt = block.getFieldValue('EVENT') || 'virada';
                this.activeBroadcasts.add(evt);
                if (this.broadcastListeners.has(evt)) {
                    for (const listener of this.broadcastListeners.get(evt)) {
                        const next = listener.getNextBlock ? listener.getNextBlock() : null;
                        if (next) this.evalBlock(next, new Set(visited));
                    }
                }
                const next = block.getNextBlock ? block.getNextBlock() : null;
                if (next) this.evalBlock(next, visited);
                return { type: 'VAL', val: 1, audio: null };
            }

            case 'event_whenflagclicked':
            case 'event_every':
            case 'event_whenbroadcastreceived':
            case 'event_whenkeypressed':
            case 'event_whencondition':
            case 'event_whenclockpulse': {
                const nextBlock = block.getNextBlock ? block.getNextBlock() : null;
                if (nextBlock) {
                    return this.evalBlock(nextBlock, visited);
                }
                return { type: 'VAL', val: 0, audio: null };
            }

            // Note Macro Reporter Block (e.g. C4 -> 60)
            case 'music_note':
            case 'seq_note': {
                const note = Number(block.getFieldValue('NOTE')) || 0;
                const octField = block.getFieldValue('OCTAVE');
                const oct = (octField !== null && octField !== undefined) ? Number(octField) : 4;
                const midi = (oct + 1) * 12 + note;
                return { type: 'VAL', val: midi, audio: null };
            }

            case 'seq_rest': {
                return { type: 'VAL', val: 0, audio: null };
            }

            // Dynamic Numeric List-Driven Sequencer
            case 'synth_seq': {
                const clkRes = this.getParamVal(block, 'CLK', 0, new Set(visited));
                const listName = block.getFieldValue('LIST') || 'notas';
                let rawList = this.lists.get(listName);

                // Fallback for chained legacy step blocks
                if (!rawList || rawList.length === 0) {
                    const notes = [];
                    let currentStepBlock = block.getInputTargetBlock('STEPS');
                    while (currentStepBlock) {
                        if (currentStepBlock.type === 'seq_note' || currentStepBlock.type === 'music_note') {
                            const noteVal = Number(currentStepBlock.getFieldValue('NOTE')) || 0;
                            const octField = currentStepBlock.getFieldValue('OCTAVE');
                            const octVal = (octField !== null && octField !== undefined) ? Number(octField) : 4;
                            notes.push((octVal + 1) * 12 + noteVal);
                        } else if (currentStepBlock.type === 'math_number') {
                            notes.push(Number(currentStepBlock.getFieldValue('NUM')) || 60);
                        }
                        currentStepBlock = currentStepBlock.getNextBlock ? currentStepBlock.getNextBlock() : null;
                    }
                    if (notes.length > 0) rawList = notes;
                }

                const list = (rawList && rawList.length > 0) ? rawList : [60, 63, 67, 70, 72, 70, 67, 63];

                for (let s = 0; s < numSamples; s++) {
                    const clk = clkRes.audio ? clkRes.audio[s] : clkRes.val;
                    if (clk > 0.5 && state.last <= 0.5) {
                        state.step = (state.step + 1) % list.length;
                        const item = list[state.step];
                        const midi = typeof item === 'number' ? item : (Number(item) || 60);
                        // 1V/Oct CV relative to C4 (60)
                        state.voct = (midi - 60) / 12.0;
                        state.gate = midi > 0 ? 1 : 0;
                    }
                    state.last = clk;
                    state.audioBuf[s] = state.voct;
                }
                return { type: 'AUDIO', val: state.voct, audio: state.audioBuf, gate: state.gate };
            }

            // Control & Logic
            case 'control_if_else': {
                const condRes = this.getParamVal(block, 'COND', 0, new Set(visited));
                const thenRes = this.getParamVal(block, 'THEN', 0, new Set(visited));
                const elseRes = this.getParamVal(block, 'ELSE', 0, new Set(visited));

                const hasAudio = !!(condRes.audio || thenRes.audio || elseRes.audio);
                for (let s = 0; s < numSamples; s++) {
                    const c = condRes.audio ? condRes.audio[s] : condRes.val;
                    const t = thenRes.audio ? thenRes.audio[s] : thenRes.val;
                    const e = elseRes.audio ? elseRes.audio[s] : elseRes.val;
                    state.audioBuf[s] = (c > 0.5) ? t : e;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'logic_and': {
                const aRes = this.getParamVal(block, 'A', 0, new Set(visited));
                const bRes = this.getParamVal(block, 'B', 0, new Set(visited));
                const hasAudio = !!(aRes.audio || bRes.audio);
                for (let s = 0; s < numSamples; s++) {
                    const a = aRes.audio ? aRes.audio[s] : aRes.val;
                    const b = bRes.audio ? bRes.audio[s] : bRes.val;
                    state.audioBuf[s] = (a > 0.5 && b > 0.5) ? 1 : 0;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'logic_or': {
                const aRes = this.getParamVal(block, 'A', 0, new Set(visited));
                const bRes = this.getParamVal(block, 'B', 0, new Set(visited));
                const hasAudio = !!(aRes.audio || bRes.audio);
                for (let s = 0; s < numSamples; s++) {
                    const a = aRes.audio ? aRes.audio[s] : aRes.val;
                    const b = bRes.audio ? bRes.audio[s] : bRes.val;
                    state.audioBuf[s] = (a > 0.5 || b > 0.5) ? 1 : 0;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'logic_not': {
                const aRes = this.getParamVal(block, 'A', 0, new Set(visited));
                const hasAudio = !!aRes.audio;
                for (let s = 0; s < numSamples; s++) {
                    const a = aRes.audio ? aRes.audio[s] : aRes.val;
                    state.audioBuf[s] = (a <= 0.5) ? 1 : 0;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'logic_xor': {
                const aRes = this.getParamVal(block, 'A', 0, new Set(visited));
                const bRes = this.getParamVal(block, 'B', 0, new Set(visited));
                const hasAudio = !!(aRes.audio || bRes.audio);
                for (let s = 0; s < numSamples; s++) {
                    const a = (aRes.audio ? aRes.audio[s] : aRes.val) > 0.5;
                    const b = (bRes.audio ? bRes.audio[s] : bRes.val) > 0.5;
                    state.audioBuf[s] = (a ^ b) ? 1 : 0;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            // Math Operations
            case 'math_arithmetic': {
                const aRes = this.getParamVal(block, 'A', 0, new Set(visited));
                const bRes = this.getParamVal(block, 'B', 0, new Set(visited));
                const op = block.getFieldValue('OP') || 'ADD';

                const hasAudio = !!(aRes.audio || bRes.audio);
                for (let s = 0; s < numSamples; s++) {
                    const a = aRes.audio ? aRes.audio[s] : aRes.val;
                    const b = bRes.audio ? bRes.audio[s] : bRes.val;
                    let res = 0;
                    if (op === 'ADD') res = a + b;
                    else if (op === 'MINUS') res = a - b;
                    else if (op === 'MULTIPLY') res = a * b;
                    else if (op === 'DIVIDE') res = b !== 0 ? a / b : 0;
                    else if (op === 'MOD') res = b !== 0 ? a % b : 0;
                    else if (op === 'POW') res = Math.pow(Math.max(0, a), b);
                    else if (op === 'MIN') res = Math.min(a, b);
                    else if (op === 'MAX') res = Math.max(a, b);
                    state.audioBuf[s] = res;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'math_map': {
                const valRes = this.getParamVal(block, 'VAL', 0, new Set(visited));
                const inMin = Number(block.getFieldValue('IN_MIN')) || 0;
                const inMax = Number(block.getFieldValue('IN_MAX')) || 1;
                const outMin = Number(block.getFieldValue('OUT_MIN')) || 200;
                const outMax = Number(block.getFieldValue('OUT_MAX')) || 2000;
                const inRange = inMax - inMin === 0 ? 0.0001 : inMax - inMin;

                const hasAudio = !!valRes.audio;
                for (let s = 0; s < numSamples; s++) {
                    const v = valRes.audio ? valRes.audio[s] : valRes.val;
                    const norm = dsp.clamp((v - inMin) / inRange, 0, 1);
                    state.audioBuf[s] = outMin + norm * (outMax - outMin);
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'math_single': {
                const op = block.getFieldValue('OP') || 'SIN';
                const numRes = this.getParamVal(block, 'NUM', 0, new Set(visited));

                const hasAudio = !!numRes.audio;
                for (let s = 0; s < numSamples; s++) {
                    const n = numRes.audio ? numRes.audio[s] : numRes.val;
                    let res = n;
                    if (op === 'SIN') res = Math.sin(n);
                    else if (op === 'COS') res = Math.cos(n);
                    else if (op === 'TAN') res = Math.tan(n);
                    else if (op === 'TANH') res = dsp.tanh(n);
                    else if (op === 'ABS') res = Math.abs(n);
                    else if (op === 'NEG') res = -n;
                    else if (op === 'SQRT') res = Math.sqrt(Math.max(0, n));
                    else if (op === 'ROUND') res = Math.round(n);
                    else if (op === 'FLOOR') res = Math.floor(n);
                    else if (op === 'CEIL') res = Math.ceil(n);
                    else if (op === 'CLAMP01') res = dsp.clamp(n, 0, 1);
                    state.audioBuf[s] = res;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            case 'math_random': {
                const from = Number(block.getFieldValue('FROM')) || 0;
                const to = Number(block.getFieldValue('TO')) || 1;
                const rnd = from + Math.random() * (to - from);
                return { type: 'VAL', val: rnd, audio: null };
            }

            case 'logic_compare_cv': {
                const resA = this.getParamVal(block, 'A', 0, new Set(visited));
                const resB = this.getParamVal(block, 'B', 0, new Set(visited));
                const op = block.getFieldValue('OP') || 'GT';

                const a = resA.val;
                const b = resB.val;
                let boolVal = false;
                if (op === 'GT') boolVal = a > b;
                else if (op === 'LT') boolVal = a < b;
                else if (op === 'EQ') boolVal = Math.abs(a - b) < 0.001;
                else if (op === 'GTE') boolVal = a >= b;
                else if (op === 'LTE') boolVal = a <= b;
                else if (op === 'NEQ') boolVal = Math.abs(a - b) >= 0.001;

                const gateVal = boolVal ? 1 : 0;
                for (let s = 0; s < numSamples; s++) state.audioBuf[s] = gateVal;
                return { type: 'VAL', val: gateVal, audio: state.audioBuf };
            }

            case 'math_number': {
                const num = Number(block.getFieldValue('NUM')) || 0;
                return { type: 'VAL', val: num, audio: null };
            }

            case 'math_note_to_hz': {
                const noteRes = this.getParamVal(block, 'NOTE', 60, new Set(visited));
                const hz = dsp.mtof(noteRes.val);
                return { type: 'VAL', val: hz, audio: null };
            }

            case 'math_note_name': {
                const noteStr = block.getFieldValue('NOTE') || 'C4';
                const midi = dsp.parseNoteToMidi(noteStr);
                return { type: 'VAL', val: midi, audio: null };
            }

            case 'math_note_convert': {
                const noteRes = this.getParamVal(block, 'NOTE', 60, new Set(visited));
                const target = block.getFieldValue('TARGET') || 'HZ';
                const midi = (typeof noteRes.val === 'string') ? dsp.parseNoteToMidi(noteRes.val) : noteRes.val;
                let converted = midi;
                if (target === 'HZ') {
                    converted = dsp.mtof(midi);
                } else if (target === 'VOCT') {
                    converted = (midi - 60) / 12.0;
                } else {
                    converted = midi;
                }
                return { type: 'VAL', val: converted, audio: null };
            }

            case 'math_transpose': {
                const noteRes = this.getParamVal(block, 'NOTE', 0, new Set(visited));
                const semi = Number(block.getFieldValue('SEMITONES')) || 0;
                const val = noteRes.val + (semi / 12.0);
                return { type: 'VAL', val, audio: null };
            }

            default:
                return { type: 'VAL', val: 0, audio: null };
        }
    }

    processBlock(outL, outR, offset = 0, numSamples = 128) {
        this.busCache.clear();

        // 1. Execute Event Hat Triggers
        for (const hat of this.hatBlocks) {
            if (hat.type === 'event_every') {
                const state = this.blockStates.get(hat.id) || this.initBlockState(hat.type);
                const time = parseFloat(hat.getFieldValue('TIME')) || 500;
                const unit = hat.getFieldValue('UNIT') || 'ms';
                let period = 24000;
                if (unit === 'ms') period = Math.max(1, (time / 1000) * 48000);
                else if (unit === 's') period = Math.max(1, time * 48000);
                else if (unit === 'beats') period = Math.max(1, (60 / 120) * time * 48000);
                else if (unit === 'clocks') period = Math.max(1, (60 / 120 / 2) * time * 48000);

                state.samplesRemaining -= numSamples;
                if (state.samplesRemaining <= 0) {
                    state.samplesRemaining = period;
                    const next = hat.getNextBlock ? hat.getNextBlock() : null;
                    if (next) this.evalBlock(next);
                }
            } else if (hat.type === 'event_whenkeypressed') {
                const state = this.blockStates.get(hat.id) || this.initBlockState(hat.type);
                const key = hat.getFieldValue('KEY') || 'Space';
                const isDown = this.pressedKeys.has(key);
                if (isDown && !state.wasPressed) {
                    const next = hat.getNextBlock ? hat.getNextBlock() : null;
                    if (next) this.evalBlock(next);
                }
                state.wasPressed = isDown;
            } else if (hat.type === 'event_whencondition') {
                const state = this.blockStates.get(hat.id) || this.initBlockState(hat.type);
                const condRes = this.getParamVal(hat, 'COND', 0);
                const currentVal = condRes.val;
                if (currentVal > 0.5 && state.lastVal <= 0.5) {
                    const next = hat.getNextBlock ? hat.getNextBlock() : null;
                    if (next) this.evalBlock(next);
                }
                state.lastVal = currentVal;
            }
        }

        // 2. Synthesize Master Audio
        if (!this.outBlock) {
            for (let s = 0; s < numSamples; s++) {
                outL[offset + s] = 0;
                outR[offset + s] = 0;
            }
            return;
        }

        const volRes = this.getParamVal(this.outBlock, 'VOL', 0.85);
        const vol = volRes.val;

        const leftInput = this.outBlock.getInputTargetBlock('LEFT');
        const rightInput = this.outBlock.getInputTargetBlock('RIGHT');

        let leftRes = leftInput ? this.evalBlock(leftInput) : null;
        let rightRes = rightInput ? this.evalBlock(rightInput) : null;

        if (!leftRes && !rightRes) {
            const prevBlock = this.outBlock.getPreviousBlock();
            if (prevBlock) {
                leftRes = this.evalBlock(prevBlock);
                rightRes = leftRes;
            }
        }

        const leftAudio = leftRes && leftRes.audio ? leftRes.audio : null;
        const rightAudio = rightRes && rightRes.audio ? rightRes.audio : leftAudio;

        for (let s = 0; s < numSamples; s++) {
            outL[offset + s] = leftAudio ? dsp.tanh(leftAudio[s] * vol) : 0;
            outR[offset + s] = rightAudio ? dsp.tanh(rightAudio[s] * vol) : 0;
        }
    }

    /**
     * Process a single module in isolation for the Rack Engine
     */
    processModule(inputSignals = new Map(), knobValues = new Map(), numSamples = 128) {
        this.inputSignals = inputSignals;
        this.knobValues = knobValues;
        this.outputSignals = new Map();
        this.busCache.clear();

        const visited = new Set();

        // 1. Run process hat blocks
        for (const hat of this.moduleProcessBlocks) {
            const next = hat.getNextBlock ? hat.getNextBlock() : null;
            if (next) this.evalBlock(next, visited);
        }

        // 2. Run any unattached output blocks
        for (const outBlock of this.moduleOutputBlocks) {
            if (!visited.has(outBlock.id)) {
                this.evalBlock(outBlock, visited);
            }
        }

        return this.outputSignals;
    }

    /**
     * Inspect workspace blocks and extract all declared module metadata, inputs, outputs, controls, and visors
     */
    static extractInterface(workspace) {
        if (!workspace) return {
            name: null,
            width: null,
            height: null,
            color: null,
            category: null,
            inputs: [],
            outputs: [],
            params: [],
            visors: [],
            decorations: []
        };
        const blocks = workspace.getAllBlocks(false);
        const inputs = [];
        const outputs = [];
        const params = [];
        const visors = [];
        const decorations = [];
        const seenIn = new Set();
        const seenOut = new Set();
        const seenParam = new Set();

        // 1. Check for module_def block
        const defBlock = blocks.find(b => b.type === 'module_def');
        const name = defBlock ? (defBlock.getFieldValue('NAME') || null) : null;
        const width = defBlock ? (Number(defBlock.getFieldValue('WIDTH')) || null) : null;
        const height = defBlock ? (Number(defBlock.getFieldValue('HEIGHT')) || null) : null;
        const color = defBlock ? (defBlock.getFieldValue('COLOR') || null) : null;
        const category = defBlock ? (defBlock.getFieldValue('CATEGORY') || null) : null;

        for (const block of blocks) {
            if (block.type === 'module_io_input') {
                const pName = block.getFieldValue('PORT') || 'In';
                const type = block.getFieldValue('TYPE') || 'AUDIO';
                if (!seenIn.has(pName)) {
                    seenIn.add(pName);
                    inputs.push({ id: pName, name: pName, type });
                }
            } else if (block.type === 'module_io_output') {
                const pName = block.getFieldValue('PORT') || 'Out';
                const type = block.getFieldValue('TYPE') || 'AUDIO';
                if (!seenOut.has(pName)) {
                    seenOut.add(pName);
                    outputs.push({ id: pName, name: pName, type });
                }
            } else if (block.type === 'module_io_knob') {
                const kName = block.getFieldValue('NAME') || 'Cutoff';
                const min = Number(block.getFieldValue('MIN')) || 0;
                const max = Number(block.getFieldValue('MAX')) || 1;
                const def = Number(block.getFieldValue('DEFAULT')) || 0.5;
                const unit = block.getFieldValue('UNIT') || '';
                if (!seenParam.has(kName)) {
                    seenParam.add(kName);
                    params.push({ id: kName, name: kName, type: 'KNOB', min, max, default: def, value: def, unit });
                }
            } else if (block.type === 'module_io_slider') {
                const sName = block.getFieldValue('NAME') || 'Volume';
                const min = Number(block.getFieldValue('MIN')) || 0;
                const max = Number(block.getFieldValue('MAX')) || 1;
                const def = Number(block.getFieldValue('DEFAULT')) || 0.5;
                if (!seenParam.has(sName)) {
                    seenParam.add(sName);
                    params.push({ id: sName, name: sName, type: 'SLIDER', min, max, default: def, value: def });
                }
            } else if (block.type === 'module_io_switch') {
                const swName = block.getFieldValue('NAME') || 'Ativo';
                const def = Number(block.getFieldValue('DEFAULT')) || 0;
                if (!seenParam.has(swName)) {
                    seenParam.add(swName);
                    params.push({ id: swName, name: swName, type: 'SWITCH', min: 0, max: 1, default: def, value: def });
                }
            } else if (block.type === 'module_io_button') {
                const bName = block.getFieldValue('NAME') || 'Trigger';
                if (!seenParam.has(bName)) {
                    seenParam.add(bName);
                    params.push({ id: bName, name: bName, type: 'BUTTON', min: 0, max: 1, default: 0, value: 0 });
                }
            } else if (block.type === 'module_io_xy') {
                const xyName = block.getFieldValue('NAME') || 'Joy';
                if (!seenParam.has(xyName)) {
                    seenParam.add(xyName);
                    params.push({ id: xyName, name: xyName, type: 'XY_PAD', defaultX: 0.5, defaultY: 0.5, valX: 0.5, valY: 0.5 });
                }
            } else if (block.type === 'module_io_wavedraw') {
                const wName = block.getFieldValue('NAME') || 'Wave';
                if (!seenParam.has(wName)) {
                    seenParam.add(wName);
                    params.push({ id: wName, name: wName, type: 'WAVE_DRAW', waveTable: new Float32Array(128) });
                }
            } else if (block.type === 'module_visor_adsr') {
                visors.push({
                    type: 'adsr',
                    attackName: block.getFieldValue('A_NAME') || 'Attack',
                    decayName: block.getFieldValue('D_NAME') || 'Decay',
                    sustainName: block.getFieldValue('S_NAME') || 'Sustain',
                    releaseName: block.getFieldValue('R_NAME') || 'Release'
                });
            } else if (block.type === 'module_visor_scope') {
                visors.push({ type: 'scope', id: block.id });
            } else if (block.type === 'module_visor_vu') {
                visors.push({ type: 'vu', id: block.id });
            } else if (block.type === 'module_visor_display') {
                visors.push({ type: 'display', id: block.id, label: block.getFieldValue('LABEL') || '' });
            } else if (block.type === 'module_visor_led') {
                visors.push({ type: 'led', id: block.id, color: block.getFieldValue('COLOR') || '#22c55e' });
            } else if (block.type === 'module_io_label') {
                decorations.push({ type: 'label', text: block.getFieldValue('TEXT') || '' });
            } else if (block.type === 'module_io_separator') {
                decorations.push({ type: 'separator' });
            }
        }

        return { name, width, height, color, category, inputs, outputs, params, visors, decorations };
    }
}
