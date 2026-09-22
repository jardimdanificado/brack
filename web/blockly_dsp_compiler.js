/**
 * =========================================================================
 * BRACK Unified Real-Time 48kHz DSP Graph Engine (web/blockly_dsp_compiler.js)
 * Executes Unified Modules, Free-Text Buses, Chained Sequencers & Math Operators
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
        this.busCache = new Map();
        this.variables = new Map();
        this.outBlock = null;
    }

    setWorkspace(workspace) {
        this.workspace = workspace;
        this.compile();
    }

    compile() {
        if (!this.workspace) return;

        const allBlocks = this.workspace.getAllBlocks(false);
        this.outBlock = allBlocks.find(b => b.type === 'synth_out') || null;

        this.sendBlocksByChannel.clear();

        for (const block of allBlocks) {
            if (!this.blockStates.has(block.id)) {
                this.blockStates.set(block.id, this.initBlockState(block.type));
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
    }

    initBlockState(type) {
        const unified = MODULE_REGISTRY.get(type);
        if (unified && unified.state) {
            return unified.state();
        }

        switch (type) {
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

    // Helper: resolve incoming audio stream (from value socket or stacked previous block)
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

    // Helper: evaluate an input value or read default field
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

    // Evaluate single block recursively (memoized per 128-sample block)
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

        // 2. Specialized Block Logic (Routing, Sequencer, Math)
        switch (block.type) {
            // 📡 Free-Text Broadcast Send Block
            case 'synth_send': {
                const src = this.getAudioSource(block, 'IN', new Set(visited));
                return src || { type: 'VAL', val: 0, audio: null };
            }

            // 📻 Free-Text Broadcast Receive Pill
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

            // 💾 Set Signal Variable
            case 'synth_var_set': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const valRes = this.getParamVal(block, 'VAL', 0, new Set(visited));
                this.variables.set(varName, valRes);
                return valRes;
            }

            // 💾 Get Signal Variable
            case 'synth_var_get': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                return this.variables.get(varName) || { type: 'VAL', val: 0, audio: null };
            }

            // 🚩 Hat Block Event Pass-Through
            case 'event_whenflagclicked': {
                const nextBlock = block.getNextBlock ? block.getNextBlock() : null;
                if (nextBlock) {
                    return this.evalBlock(nextBlock, visited);
                }
                return { type: 'VAL', val: 0, audio: null };
            }

            // 🎹 Dynamic Chained Note Sequencer
            case 'synth_seq': {
                const clkRes = this.getParamVal(block, 'CLK', 0, new Set(visited));

                // Harvest connected note steps dynamically
                const notes = [];
                let currentStepBlock = block.getInputTargetBlock('STEPS');
                while (currentStepBlock) {
                    if (currentStepBlock.type === 'seq_note') {
                        const noteVal = Number(currentStepBlock.getFieldValue('NOTE')) || 0;
                        const octVal = Number(currentStepBlock.getFieldValue('OCTAVE')) || 0;
                        const gateMode = currentStepBlock.getFieldValue('GATE') || '1';
                        notes.push({ note: noteVal, octave: octVal, gate: gateMode });
                    } else if (currentStepBlock.type === 'seq_rest') {
                        notes.push({ note: 0, octave: 0, gate: '0' });
                    }
                    currentStepBlock = currentStepBlock.getNextBlock ? currentStepBlock.getNextBlock() : null;
                }

                if (notes.length === 0) {
                    notes.push({ note: 0, octave: 0, gate: '1' }, { note: 7, octave: 0, gate: '1' });
                }

                for (let s = 0; s < numSamples; s++) {
                    const clk = clkRes.audio ? clkRes.audio[s] : clkRes.val;
                    if (clk > 0.5 && state.last <= 0.5) {
                        state.step = (state.step + 1) % notes.length;
                        const n = notes[state.step];
                        state.voct = (n.note / 12) + n.octave;
                        state.gate = n.gate === '1' ? 1 : (n.gate === '2' ? 1 : 0);
                    }
                    state.last = clk;
                    state.audioBuf[s] = state.voct;
                }
                return { type: 'AUDIO', val: state.voct, audio: state.audioBuf, gate: state.gate };
            }

            // ➕ Scratch Math Arithmetic (+, -, *, /, mod)
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
                    state.audioBuf[s] = res;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            // ➕ Scratch Math Map Range
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

            // ➕ Scratch Math Single Function
            case 'math_single': {
                const op = block.getFieldValue('OP') || 'SIN';
                const numRes = this.getParamVal(block, 'NUM', 0, new Set(visited));

                const hasAudio = !!numRes.audio;
                for (let s = 0; s < numSamples; s++) {
                    const n = numRes.audio ? numRes.audio[s] : numRes.val;
                    let res = n;
                    if (op === 'SIN') res = Math.sin(n);
                    else if (op === 'COS') res = Math.cos(n);
                    else if (op === 'TANH') res = dsp.tanh(n);
                    else if (op === 'ABS') res = Math.abs(n);
                    else if (op === 'NEG') res = -n;
                    else if (op === 'SQRT') res = Math.sqrt(Math.max(0, n));
                    else if (op === 'ROUND') res = Math.round(n);
                    else if (op === 'CLAMP01') res = dsp.clamp(n, 0, 1);
                    state.audioBuf[s] = res;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            // ➕ Scratch Math Random
            case 'math_random': {
                const from = Number(block.getFieldValue('FROM')) || 0;
                const to = Number(block.getFieldValue('TO')) || 1;
                const rnd = from + Math.random() * (to - from);
                return { type: 'VAL', val: rnd, audio: null };
            }

            // ➕ Scratch Logic Compare (<, >, =, >=, <=)
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

                const gateVal = boolVal ? 1 : 0;
                for (let s = 0; s < numSamples; s++) state.audioBuf[s] = gateVal;
                return { type: 'VAL', val: gateVal, audio: state.audioBuf };
            }

            // 💾 Change Signal Variable (Accumulator)
            case 'synth_var_change': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const deltaRes = this.getParamVal(block, 'DELTA', 1, new Set(visited));
                const current = this.variables.get(varName) || { type: 'VAL', val: 0, audio: null };
                const newVal = (current.val || 0) + (deltaRes.val || 0);
                const updated = { type: 'VAL', val: newVal, audio: null };
                this.variables.set(varName, updated);
                return updated;
            }

            // 💾 Reset Signal Variable
            case 'synth_var_reset': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const zeroVal = { type: 'VAL', val: 0, audio: null };
                this.variables.set(varName, zeroVal);
                return zeroVal;
            }

            // 🔀 Scratch If / Else Signal Selector (Multiplexer)
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

            // 🔀 Scratch Logic AND (A and B)
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

            // 🔀 Scratch Logic OR (A or B)
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

            // 🔀 Scratch Logic NOT (not A)
            case 'logic_not': {
                const aRes = this.getParamVal(block, 'A', 0, new Set(visited));
                const hasAudio = !!aRes.audio;
                for (let s = 0; s < numSamples; s++) {
                    const a = aRes.audio ? aRes.audio[s] : aRes.val;
                    state.audioBuf[s] = (a <= 0.5) ? 1 : 0;
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            // 📋 Scratch List Item Lookup
            case 'math_list_item': {
                const idxRes = this.getParamVal(block, 'INDEX', 0, new Set(visited));
                const listRaw = block.getFieldValue('LIST') || '0';
                const items = listRaw.split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
                const len = items.length > 0 ? items.length : 1;
                const safeItems = items.length > 0 ? items : [0];

                const hasAudio = !!idxRes.audio;
                for (let s = 0; s < numSamples; s++) {
                    const rawIdx = idxRes.audio ? idxRes.audio[s] : idxRes.val;
                    const cleanIdx = Math.floor(Math.abs(rawIdx)) % len;
                    state.audioBuf[s] = safeItems[cleanIdx];
                }
                return hasAudio ? { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf } : { type: 'VAL', val: state.audioBuf[0], audio: null };
            }

            // ➕ Constant Number Pill
            case 'math_number': {
                const num = Number(block.getFieldValue('NUM')) || 0;
                return { type: 'VAL', val: num, audio: null };
            }

            // ➕ MIDI Note to Hz
            case 'math_note_to_hz': {
                const noteRes = this.getParamVal(block, 'NOTE', 60, new Set(visited));
                const hz = dsp.mtof(noteRes.val);
                return { type: 'VAL', val: hz, audio: null };
            }

            default:
                return { type: 'VAL', val: 0, audio: null };
        }
    }

    // Render 128 samples to speaker buffer
    processBlock(outL, outR, offset, numSamples = 128) {
        this.busCache.clear();

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
}
