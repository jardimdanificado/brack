/**
 * =========================================================================
 * BRACK Unlimited Scratch Modular DSP Compiler & Engine (web/blockly_dsp_compiler.js)
 * Free-Text Bus Routing, Open Parameters, Full Math Operators, 48kHz Real-Time DSP
 * =========================================================================
 */

import { dsp } from './dsp_toolkit.js';

export class BlocklySynthEngine {
    constructor(sampleRate = 48000) {
        this.sampleRate = sampleRate;
        this.blockStates = new Map(); // block.id -> state object
        this.variables = new Map(); // varName -> { type, val, audio }
        this.outBlock = null;
        this.workspace = null;
        this.sendBlocksByChannel = new Map(); // channelName -> [sendBlock1, sendBlock2, ...]
        this.busCache = new Map(); // channelName -> { type, val, audio } (cleared per 128-sample block)
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
        switch (type) {
            case 'synth_clock':
                return { phase: 0, gate: 0, audioBuf: new Float32Array(128) };
            case 'synth_seq':
                return { step: 0, last: 0, voct: 0, gate: 0, audioBuf: new Float32Array(128) };
            case 'synth_lfo':
                return { phase: 0, sampleHold: 0, audioBuf: new Float32Array(128) };
            case 'synth_sample_hold':
                return { latchedVal: 0, lastTrig: 0, audioBuf: new Float32Array(128) };
            case 'synth_vco':
                return { phase: 0, audioBuf: new Float32Array(128) };
            case 'synth_vcf':
                return { moog: [0, 0, 0, 0], audioBuf: new Float32Array(128) };
            case 'synth_adsr':
                return { level: 0, stage: 0, lastGate: 0, audioBuf: new Float32Array(128) };
            case 'synth_vca':
            case 'synth_distortion':
            case 'synth_mixer':
            case 'math_arithmetic':
            case 'math_map':
            case 'math_single':
            case 'math_note_to_hz':
            case 'logic_compare_cv':
                return { audioBuf: new Float32Array(128) };
            case 'synth_delay':
                return { buf: new Float32Array(96000), head: 0, lpf: 0, audioBuf: new Float32Array(128) };
            case 'synth_bytebeat':
                return { t: 0, phase: 0, audioBuf: new Float32Array(128) };
            case 'synth_out':
                return { outL: new Float32Array(128), outR: new Float32Array(128) };
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

        switch (block.type) {
            // 📡 Free-Text Broadcast Send Block
            case 'synth_send': {
                const src = this.getAudioSource(block, 'IN', new Set(visited));
                return src || { type: 'VAL', val: 0, audio: null };
            }

            // 📻 Free-Text Broadcast Receive Block (Teleport Bus)
            case 'synth_recv': {
                const ch = block.getFieldValue('CHANNEL') || 'meu_sinal';
                if (this.busCache.has(ch)) {
                    return this.busCache.get(ch);
                }

                const sends = this.sendBlocksByChannel.get(ch) || [];
                if (sends.length === 0) {
                    const fallback = { type: 'VAL', val: 0, audio: null };
                    this.busCache.set(ch, fallback);
                    return fallback;
                }

                let sumAudio = new Float32Array(numSamples);
                let sumVal = 0;
                let hasAudio = false;

                for (const sendBlock of sends) {
                    const res = this.evalBlock(sendBlock, new Set(visited));
                    if (res) {
                        if (res.audio) {
                            hasAudio = true;
                            for (let s = 0; s < numSamples; s++) sumAudio[s] += res.audio[s];
                        }
                        if (typeof res.val === 'number') {
                            sumVal += res.val;
                        }
                    }
                }

                const result = hasAudio ? { type: 'AUDIO', val: sumVal, audio: sumAudio } : { type: 'VAL', val: sumVal, audio: null };
                this.busCache.set(ch, result);
                return result;
            }

            // Variáveis Scratch
            case 'synth_var_set': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                const res = this.evalBlock(block.getInputTargetBlock('VAL'), new Set(visited));
                if (res) this.variables.set(varName, res);
                return res || { type: 'VAL', val: 0, audio: null };
            }

            case 'synth_var_get': {
                const varName = block.getFieldValue('VAR') || 'voltagem';
                return this.variables.get(varName) || { type: 'VAL', val: 0, audio: null };
            }

            case 'event_whenflagclicked': {
                return { type: 'VAL', val: 1, audio: null };
            }

            case 'event_whenclockpulse': {
                const clkRes = this.getParamVal(block, 'CLK', 1, new Set(visited));
                return { type: 'VAL', val: clkRes.val, audio: clkRes.audio };
            }

            // ⚡ Master Clock
            case 'synth_clock': {
                const bpmRes = this.getParamVal(block, 'BPM', 120, new Set(visited));
                const pwRes = this.getParamVal(block, 'PW', 0.5, new Set(visited));
                const bpm = bpmRes.val > 10 ? bpmRes.val : 120;
                const pw = dsp.clamp(pwRes.val, 0.05, 0.95);
                const dt = (bpm / 60 * 2) / this.sampleRate;

                for (let s = 0; s < numSamples; s++) {
                    state.phase = (state.phase + dt) % 1;
                    state.gate = (state.phase < pw) ? 1 : 0;
                    state.audioBuf[s] = state.gate;
                }
                return { type: 'VAL', val: state.gate, audio: state.audioBuf };
            }

            // 〰️ LFO Modulator
            case 'synth_lfo': {
                const wave = block.getFieldValue('WAVE') || 'tri';
                const freqRes = this.getParamVal(block, 'FREQ', 1.5, new Set(visited));
                const depthRes = this.getParamVal(block, 'DEPTH', 1.0, new Set(visited));
                const freq = freqRes.val > 0.001 ? freqRes.val : 1.5;
                const depth = depthRes.val;
                const dt = freq / this.sampleRate;

                for (let s = 0; s < numSamples; s++) {
                    state.phase = (state.phase + dt) % 1;
                    let smp = 0;
                    if (wave === 'sin') smp = Math.sin(state.phase * 6.283185307179586);
                    else if (wave === 'tri') smp = (state.phase < 0.5 ? 4 * state.phase - 1 : 3 - 4 * state.phase);
                    else if (wave === 'sqr') smp = state.phase < 0.5 ? 1 : -1;
                    else if (wave === 'saw') smp = 2 * state.phase - 1;
                    else if (wave === 'rnd') {
                        if (state.phase < dt) state.sampleHold = (Math.random() * 2) - 1;
                        smp = state.sampleHold;
                    }
                    state.audioBuf[s] = smp * depth;
                }
                return { type: 'VAL', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // 🎲 Sample & Hold
            case 'synth_sample_hold': {
                const inRes = this.getParamVal(block, 'IN', 0, new Set(visited));
                const trigRes = this.getParamVal(block, 'TRIG', 0, new Set(visited));

                for (let s = 0; s < numSamples; s++) {
                    const trigVal = trigRes.audio ? trigRes.audio[s] : trigRes.val;
                    const inVal = inRes.audio ? inRes.audio[s] : inRes.val;
                    if (trigVal > 0.5 && state.lastTrig <= 0.5) {
                        state.latchedVal = inVal;
                    }
                    state.lastTrig = trigVal;
                    state.audioBuf[s] = state.latchedVal;
                }
                return { type: 'VAL', val: state.latchedVal, audio: state.audioBuf };
            }

            // 🎹 Open Chained Note Sequencer
            case 'synth_seq': {
                const clkRes = this.getParamVal(block, 'CLK', 0, new Set(visited));
                const clkVal = clkRes.val;

                const notes = [];
                let stepBlock = block.getInputTargetBlock('STEPS');
                while (stepBlock) {
                    if (stepBlock.type === 'seq_note') {
                        const note = Number(stepBlock.getFieldValue('NOTE')) || 0;
                        const oct = Number(stepBlock.getFieldValue('OCTAVE')) || 0;
                        const gate = Number(stepBlock.getFieldValue('GATE')) || 1;
                        notes.push({ voct: (note / 12) + oct, gate: gate });
                    } else if (stepBlock.type === 'seq_rest') {
                        notes.push({ voct: 0, gate: 0 });
                    }
                    stepBlock = stepBlock.getNextBlock();
                }

                if (notes.length === 0) notes.push({ voct: 0, gate: 1 });

                if (clkVal > 0.5 && state.last <= 0.5) {
                    state.step = (state.step + 1) % notes.length;
                }
                state.last = clkVal;

                const currStep = notes[state.step % notes.length];
                state.voct = currStep.voct;
                state.gate = (currStep.gate === 1) ? (clkVal > 0.5 ? 1 : 0) : (currStep.gate === 2 ? 1 : 0);

                for (let s = 0; s < numSamples; s++) {
                    state.audioBuf[s] = state.voct;
                }

                return { type: 'VAL', val: state.voct, gate: state.gate, audio: state.audioBuf };
            }

            // 〰️ VCO Oscillator (Open Parameters)
            case 'synth_vco': {
                const wave = block.getFieldValue('WAVE') || 'saw';
                const freqRes = this.getParamVal(block, 'FREQ', 130.81, new Set(visited));
                const fmRes = this.getParamVal(block, 'FM', 0, new Set(visited));
                const pwRes = this.getParamVal(block, 'PW', 0.5, new Set(visited));

                const baseFreq = freqRes.val > 0 ? freqRes.val : 130.81;

                for (let s = 0; s < numSamples; s++) {
                    const fmVal = fmRes.audio ? fmRes.audio[s] : fmRes.val;
                    const pwVal = dsp.clamp(pwRes.audio ? pwRes.audio[s] : pwRes.val, 0.05, 0.95);
                    const curFreq = fmVal !== 0 ? dsp.voct(fmVal, baseFreq) : baseFreq;
                    const dt = curFreq / this.sampleRate;

                    let smp = (wave === 'saw') ? dsp.saw(state.phase, dt) :
                              (wave === 'sqr') ? dsp.sqr(state.phase, pwVal, dt) :
                              (wave === 'tri') ? dsp.tri(state.phase) :
                              (wave === 'sin') ? dsp.sin(state.phase) : dsp.noise();

                    state.phase = (state.phase + dt) % 1;
                    state.audioBuf[s] = smp;
                }
                return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // 📈 ADSR Envelope
            case 'synth_adsr': {
                const gateRes = this.getParamVal(block, 'GATE', 0, new Set(visited));
                const aRes = this.getParamVal(block, 'ATTACK', 0.01, new Set(visited));
                const dRes = this.getParamVal(block, 'DECAY', 0.20, new Set(visited));
                const sRes = this.getParamVal(block, 'SUSTAIN', 0.25, new Set(visited));
                const rRes = this.getParamVal(block, 'RELEASE', 0.20, new Set(visited));

                const gate = (gateRes.val > 0.1 || (gateRes.audio && gateRes.audio[0] > 0.1)) ? 1 : 0;
                if (gate && !state.lastGate) state.stage = 1;
                if (!gate && state.lastGate) state.stage = 4;
                state.lastGate = gate;

                const aRate = 1 / (Math.max(0.001, aRes.val) * this.sampleRate);
                const dRate = 1 / (Math.max(0.001, dRes.val) * this.sampleRate);
                const sLvl  = dsp.clamp(sRes.val, 0, 1);
                const rRate = 1 / (Math.max(0.001, rRes.val) * this.sampleRate);

                for (let s = 0; s < numSamples; s++) {
                    if (state.stage === 1) {
                        state.level += aRate * (1.2 - state.level);
                        if (state.level >= 1) { state.level = 1; state.stage = 2; }
                    } else if (state.stage === 2) {
                        state.level -= dRate * (state.level - sLvl);
                        if (state.level <= sLvl + 0.001) { state.level = sLvl; state.stage = 3; }
                    } else if (state.stage === 3) {
                        state.level = sLvl;
                    } else if (state.stage === 4) {
                        state.level -= rRate * state.level;
                        if (state.level <= 0.0001) { state.level = 0; state.stage = 0; }
                    }
                    state.audioBuf[s] = state.level;
                }
                return { type: 'VAL', val: state.level, audio: state.audioBuf };
            }

            // 🎛️ 24dB Moog VCF (Open Cutoff & Res)
            case 'synth_vcf': {
                const inRes = this.getAudioSource(block, 'IN', new Set(visited));
                const inAudio = inRes && inRes.audio ? inRes.audio : null;

                if (!inAudio) {
                    state.audioBuf.fill(0);
                    return { type: 'AUDIO', val: 0, audio: state.audioBuf };
                }

                const cutoffRes = this.getParamVal(block, 'CUTOFF', 800, new Set(visited));
                const resRes = this.getParamVal(block, 'RES', 0.7, new Set(visited));

                for (let s = 0; s < numSamples; s++) {
                    let fc = cutoffRes.audio ? cutoffRes.audio[s] : cutoffRes.val;
                    if (fc < 20) fc = 20;
                    if (fc > 20000) fc = 20000;
                    const r = dsp.clamp(resRes.audio ? resRes.audio[s] : resRes.val, 0, 0.95);
                    state.audioBuf[s] = dsp.moog(state.moog, inAudio[s], fc, r, 1.2, this.sampleRate);
                }
                return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // 🔊 VCA Amplifier
            case 'synth_vca': {
                const inRes = this.getAudioSource(block, 'IN', new Set(visited));
                const inAudio = inRes && inRes.audio ? inRes.audio : null;

                if (!inAudio) {
                    state.audioBuf.fill(0);
                    return { type: 'AUDIO', val: 0, audio: state.audioBuf };
                }

                const gainRes = this.getParamVal(block, 'GAIN', 1.0, new Set(visited));
                const isExp = block.getFieldValue('EXP') === '1';

                for (let s = 0; s < numSamples; s++) {
                    let g = dsp.clamp(gainRes.audio ? gainRes.audio[s] : gainRes.val, 0, 3.0);
                    if (isExp) g = g * g * g;
                    state.audioBuf[s] = inAudio[s] * g;
                }
                return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // 🔥 Distortion & Wavefolder
            case 'synth_distortion': {
                const inRes = this.getAudioSource(block, 'IN', new Set(visited));
                const inAudio = inRes && inRes.audio ? inRes.audio : null;

                if (!inAudio) {
                    state.audioBuf.fill(0);
                    return { type: 'AUDIO', val: 0, audio: state.audioBuf };
                }

                const driveRes = this.getParamVal(block, 'DRIVE', 2.0, new Set(visited));
                const mode = block.getFieldValue('MODE') || 'tanh';

                for (let s = 0; s < numSamples; s++) {
                    const drive = driveRes.audio ? driveRes.audio[s] : driveRes.val;
                    let smp = inAudio[s] * drive;
                    if (mode === 'tanh') smp = dsp.tanh(smp);
                    else if (mode === 'hard') smp = dsp.clamp(smp, -1, 1);
                    else if (mode === 'crush') smp = Math.round(smp * 8) / 8;
                    else if (mode === 'fold') {
                        // Wavefolding math: reflection between -1 and 1
                        while (smp > 1 || smp < -1) {
                            if (smp > 1) smp = 2 - smp;
                            else if (smp < -1) smp = -2 - smp;
                        }
                    }
                    state.audioBuf[s] = smp;
                }
                return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // 🎚️ 2-Channel Summing Mixer
            case 'synth_mixer': {
                const in1Res = this.getParamVal(block, 'IN1', 0, new Set(visited));
                const in2Res = this.getParamVal(block, 'IN2', 0, new Set(visited));
                const vol1Res = this.getParamVal(block, 'VOL1', 1.0, new Set(visited));
                const vol2Res = this.getParamVal(block, 'VOL2', 1.0, new Set(visited));

                for (let s = 0; s < numSamples; s++) {
                    const a1 = in1Res.audio ? in1Res.audio[s] : in1Res.val;
                    const a2 = in2Res.audio ? in2Res.audio[s] : in2Res.val;
                    const v1 = vol1Res.audio ? vol1Res.audio[s] : vol1Res.val;
                    const v2 = vol2Res.audio ? vol2Res.audio[s] : vol2Res.val;
                    state.audioBuf[s] = a1 * v1 + a2 * v2;
                }
                return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // 📼 Tape Delay
            case 'synth_delay': {
                const inRes = this.getAudioSource(block, 'IN', new Set(visited));
                const inAudio = inRes && inRes.audio ? inRes.audio : null;

                if (!inAudio) {
                    state.audioBuf.fill(0);
                    return { type: 'AUDIO', val: 0, audio: state.audioBuf };
                }

                const timeRes = this.getParamVal(block, 'TIME', 0.25, new Set(visited));
                const fbRes = this.getParamVal(block, 'FB', 0.50, new Set(visited));
                const mixRes = this.getParamVal(block, 'MIX', 0.35, new Set(visited));

                for (let s = 0; s < numSamples; s++) {
                    const delayTime = dsp.clamp(timeRes.audio ? timeRes.audio[s] : timeRes.val, 0.01, 1.8);
                    const fb = dsp.clamp(fbRes.audio ? fbRes.audio[s] : fbRes.val, 0, 0.95);
                    const mix = dsp.clamp(mixRes.audio ? mixRes.audio[s] : mixRes.val, 0, 1.0);
                    const delaySamples = Math.floor(delayTime * this.sampleRate);

                    let r = state.head - delaySamples;
                    if (r < 0) r += 96000;
                    const delayed = state.buf[r];
                    state.lpf = delayed * 0.6 + state.lpf * 0.4;
                    state.buf[state.head] = inAudio[s] + dsp.tanh(state.lpf * fb);
                    state.head = (state.head + 1) % 96000;
                    state.audioBuf[s] = dsp.lerp(inAudio[s], delayed, mix);
                }
                return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // 👾 Bytebeat 8-Bit
            case 'synth_bytebeat': {
                const speedRes = this.getParamVal(block, 'SPEED', 8000, new Set(visited));
                const speed = speedRes.val > 0 ? speedRes.val : 8000;
                const dt = speed / this.sampleRate;
                const formula = Number(block.getFieldValue('FORMULA')) || 0;

                for (let s = 0; s < numSamples; s++) {
                    state.phase += dt;
                    if (state.phase >= 1) { state.phase -= 1; state.t++; }
                    const t = state.t;
                    let v = (formula === 0) ? (t * ((t>>12|t>>8)&63&t>>4)) :
                            (formula === 1) ? ((t>>7|t|t>>6)*10+4*(t&t>>13|t>>6)) :
                            (formula === 2) ? ((t*(t>>5|t>>8))>>(t>>16)) : ((t*5&t>>7)|(t*3&t>>10));
                    state.audioBuf[s] = ((v & 255) / 127.5) - 1.0;
                }
                return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
            }

            // ➕ Scratch Math Arithmetic (+, -, *, /, mod)
            case 'math_arithmetic': {
                const resA = this.getParamVal(block, 'A', 0, new Set(visited));
                const resB = this.getParamVal(block, 'B', 0, new Set(visited));
                const op = block.getFieldValue('OP') || 'ADD';

                const hasAudio = resA.audio || resB.audio;
                for (let s = 0; s < numSamples; s++) {
                    const a = resA.audio ? resA.audio[s] : resA.val;
                    const b = resB.audio ? resB.audio[s] : resB.val;
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
                const outMin = Number(block.getFieldValue('OUT_MIN')) || 100;
                const outMax = Number(block.getFieldValue('OUT_MAX')) || 8000;
                const inRange = inMax - inMin || 1;

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

        // If no value cable connected to L/R, check if a module is stacked directly above OUT!
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

