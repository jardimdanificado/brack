/**
 * =========================================================================
 * BRACK Module Script Runtime & Sandbox (web/module_runtime.js)
 * Executes user module scripts with safe isolation, hot-reloading & DSP helpers
 * =========================================================================
 */

import { dsp } from './dsp_toolkit.js';

export class ScriptableModule {
    constructor(id, codeString, sampleRate) {
        this.id = id;
        this.sampleRate = sampleRate || 48000;
        this.state = {};
        this.params = [];
        this.paramDefs = [];
        this.outputDefs = [];
        this.code = codeString;
        this.error = null;
        this.compiledModule = null;

        // Pre-allocated Audio & MIDI Output buffers
        this.audioOutputs = [];
        for (let o = 0; o < 8; o++) {
            this.audioOutputs.push(new Float32Array(128));
        }
        this.midiOutputs = [];
        for (let o = 0; o < 8; o++) {
            this.midiOutputs.push([]);
        }
        this.valOutputs = new Float32Array(8);

        this.outputsHelper = {
            audio: (idx) => this.audioOutputs[idx || 0],
            midi: (idx, event) => {
                if (event) this.midiOutputs[idx || 0].push(event);
                return this.midiOutputs[idx || 0];
            },
            val: (idx, value) => {
                this.valOutputs[idx || 0] = value;
            }
        };

        this.compile(codeString);
    }

    compile(codeString) {
        try {
            let cleanCode = codeString.trim();
            if (/export\s+default\s+/.test(cleanCode)) {
                cleanCode = cleanCode.replace(/export\s+default\s+/, 'return ');
            } else if (/module\.exports\s*=\s*/.test(cleanCode)) {
                cleanCode = cleanCode.replace(/module\.exports\s*=\s*/, 'return ');
            } else if (!cleanCode.startsWith('return')) {
                cleanCode = 'return ' + cleanCode;
            }

            const factory = new Function(
                'dsp', 'saw', 'sqr', 'tri', 'sin', 'noise', 'clamp', 'lerp', 'tanh', 'moog', 'svf', 'voct', 'mtof',
                cleanCode
            );
            const modObj = factory(
                dsp, dsp.saw, dsp.sqr, dsp.tri, dsp.sin, dsp.noise, dsp.clamp, dsp.lerp, dsp.tanh, dsp.moog, dsp.svf, dsp.voct, dsp.mtof
            );

            if (!modObj || typeof modObj.process !== 'function') {
                throw new Error('Module must return an object with a process(in, out, dsp) function');
            }

            this.compiledModule = modObj;
            this.code = codeString;

            // Normalize Param Definitions (supports both Object & Array schemas)
            this.paramDefs = [];
            this.paramKeyMap = {};

            if (Array.isArray(modObj.params)) {
                this.paramDefs = modObj.params.map((p, idx) => ({
                    id: p.id !== undefined ? p.id : idx,
                    name: p.name || `Param${idx}`,
                    key: p.key || p.name || `param${idx}`,
                    default: p.default !== undefined ? p.default : 0.5,
                    min: p.min !== undefined ? p.min : 0,
                    max: p.max !== undefined ? p.max : 1,
                    unit: p.unit || ''
                }));
            } else if (modObj.params && typeof modObj.params === 'object') {
                let pIdx = 0;
                for (const [k, v] of Object.entries(modObj.params)) {
                    const defVal = Array.isArray(v) ? v[0] : (typeof v === 'number' ? v : 0.5);
                    const minVal = Array.isArray(v) && v[1] !== undefined ? v[1] : 0;
                    const maxVal = Array.isArray(v) && v[2] !== undefined ? v[2] : (minVal > 0 ? minVal * 10 : 1);
                    const unitStr = Array.isArray(v) && v[3] !== undefined ? v[3] : '';

                    this.paramDefs.push({
                        id: pIdx,
                        name: k,
                        key: k,
                        default: defVal,
                        min: minVal,
                        max: maxVal,
                        unit: unitStr
                    });
                    pIdx++;
                }
            }

            // Create Smart Param Proxy on instance
            this.paramsProxy = [];
            this.paramDefs.forEach((p, idx) => {
                if (this.params[idx] === undefined) {
                    this.params[idx] = p.default;
                }
                this.paramsProxy[idx] = this.params[idx];
                this.paramsProxy[p.key] = this.params[idx];
                this.paramsProxy[p.name] = this.params[idx];
            });

            this.socketDefs = (modObj.inputs || modObj.sockets || []).map((s, idx) => {
                if (typeof s === 'string') return { name: s, type: s.toLowerCase().includes('val') || s.toLowerCase().includes('cv') || s.toLowerCase().includes('pitch') || s.toLowerCase().includes('gate') ? 'VAL' : 'AUDIO' };
                return { name: s.name || `IN${idx}`, type: (s.type || 'AUDIO').toUpperCase() };
            });

            this.pillDefs = (modObj.outputs || modObj.pills || [{ name: 'OUT', type: 'AUDIO' }]).map((p, idx) => {
                if (typeof p === 'string') return { name: p, type: 'AUDIO', color: 0xFF48dbfb };
                return { name: p.name || `OUT${idx}`, type: (p.type || 'AUDIO').toUpperCase(), color: p.color || 0 };
            });
            this.outputDefs = this.pillDefs;

            // Initialize module state
            if (typeof modObj.init === 'function') {
                modObj.init.call(this.state, this.sampleRate);
            }

            this.error = null;
            return { success: true };
        } catch (err) {
            this.error = err.message;
            console.warn(`[Module ${this.id} Compile Error]:`, err);
            return { success: false, error: err.message };
        }
    }

    setParam(paramId, value) {
        this.params[paramId] = value;
        if (this.paramDefs[paramId]) {
            const p = this.paramDefs[paramId];
            if (this.paramsProxy) {
                this.paramsProxy[paramId] = value;
                this.paramsProxy[p.key] = value;
                this.paramsProxy[p.name] = value;
            }
        }
    }

    getParam(paramId) {
        return this.params[paramId] !== undefined ? this.params[paramId] : 0.0;
    }

    process(rawInputs, numSamples) {
        if (!this.compiledModule || this.error) {
            for (let o = 0; o < this.audioOutputs.length; o++) {
                this.audioOutputs[o].fill(0);
                this.midiOutputs[o].length = 0;
                this.valOutputs[o] = 0;
            }
            return;
        }

        // Reset output audio & midi buffers
        for (let o = 0; o < this.audioOutputs.length; o++) {
            this.audioOutputs[o].fill(0);
            this.midiOutputs[o].length = 0;
        }

        // Build Smart In Object
        const inAudioSum = new Float32Array(numSamples);
        const inAudios = [];
        const inVals = [];
        let inValSum = 0.0;
        let hasAudio = false;
        let hasVal = false;
        const inMidi = [];
        const socketMap = {};

        for (let i = 0; i < rawInputs.length; i++) {
            const link = rawInputs[i];
            if (link.type === 'audio' && link.audio) {
                hasAudio = true;
                inAudios.push(link.audio);
                for (let s = 0; s < numSamples; s++) {
                    inAudioSum[s] += link.audio[s] * (link.gain !== undefined ? link.gain : 1.0);
                }
                if (link.socketName) socketMap[link.socketName.toLowerCase()] = { type: 'audio', audio: link.audio };
            } else if (link.type === 'val' && link.val !== undefined) {
                hasVal = true;
                inVals.push(link.val);
                inValSum += link.val;
                if (link.socketName) socketMap[link.socketName.toLowerCase()] = { type: 'val', val: link.val };
            } else if (link.type === 'midi' && link.events) {
                for (const ev of link.events) inMidi.push(ev);
                if (link.socketName) socketMap[link.socketName.toLowerCase()] = { type: 'midi', events: link.events };
            }
        }

        const inHelper = {
            audio: inAudioSum,
            audios: inAudios,
            val: inValSum,
            vals: inVals,
            hasAudio,
            hasVal,
            hasMidi: inMidi.length > 0,
            midi: inMidi,
            events: inMidi,
            has: (name) => {
                if (!name) return hasAudio || hasVal;
                return socketMap[name.toLowerCase()] !== undefined;
            },
            getVal: (name, fallback = 0) => {
                if (name && socketMap[name.toLowerCase()]) return socketMap[name.toLowerCase()].val;
                return hasVal ? inValSum : fallback;
            },
            getAudio: (name) => {
                if (name && socketMap[name.toLowerCase()]) return socketMap[name.toLowerCase()].audio;
                return inAudioSum;
            }
        };

        // Build Smart Out Object
        const outHelper = {
            audio: (arg1, arg2) => {
                if (typeof arg1 === 'function') {
                    // One-liner loop over default out 0: out.audio(s => ...)
                    const buf = this.audioOutputs[0];
                    for (let s = 0; s < numSamples; s++) buf[s] = arg1(s);
                    return buf;
                } else if (typeof arg1 === 'number' && typeof arg2 === 'function') {
                    // Loop over specific out channel: out.audio(1, s => ...)
                    const buf = this.audioOutputs[arg1];
                    for (let s = 0; s < numSamples; s++) buf[s] = arg2(s);
                    return buf;
                } else if (typeof arg1 === 'string' && typeof arg2 === 'function') {
                    // Named output pill: out.audio('lp', s => ...)
                    const pIdx = this.pillDefs.findIndex(p => p.name.toLowerCase() === arg1.toLowerCase());
                    const idx = pIdx >= 0 ? pIdx : 0;
                    const buf = this.audioOutputs[idx];
                    for (let s = 0; s < numSamples; s++) buf[s] = arg2(s);
                    return buf;
                } else if (arg1 instanceof Float32Array) {
                    this.audioOutputs[0].set(arg1);
                    return this.audioOutputs[0];
                }
                return this.audioOutputs[arg1 || 0];
            },
            val: (arg1, arg2) => {
                if (typeof arg1 === 'number' && arg2 === undefined) {
                    this.valOutputs[0] = arg1;
                } else if (typeof arg1 === 'number' && typeof arg2 === 'number') {
                    this.valOutputs[arg1] = arg2;
                } else if (typeof arg1 === 'string' && typeof arg2 === 'number') {
                    const pIdx = this.pillDefs.findIndex(p => p.name.toLowerCase() === arg1.toLowerCase());
                    const idx = pIdx >= 0 ? pIdx : 0;
                    this.valOutputs[idx] = arg2;
                }
                return this.valOutputs[arg1 || 0];
            },
            midi: (arg1, arg2) => {
                if (arg2 === undefined && arg1) {
                    this.midiOutputs[0].push(arg1);
                } else if (arg2) {
                    this.midiOutputs[arg1].push(arg2);
                }
                return this.midiOutputs[arg1 || 0];
            },
            0: this.audioOutputs[0],
            1: this.audioOutputs[1]
        };

        try {
            this.state.params = this.paramsProxy || this.params;
            this.compiledModule.params = this.paramsProxy || this.params;
            this.compiledModule.process.call(
                this.state,
                inHelper,
                outHelper,
                dsp,
                this.sampleRate
            );
        } catch (err) {
            this.error = err.message;
            console.error(`[Module ${this.id} Runtime Error]:`, err);
        }
    }

    draw(quadroChalk, writeWasmString) {
        if (!this.compiledModule || typeof this.compiledModule.draw !== 'function' || this.error) return;

        const ptrX = 1040;
        const ptrY = 1044;
        const ptrW = 1048;
        const ptrH = 1052;

        const ok = quadroChalk.quadro_chalk_get_node_rect(this.id, ptrX, ptrY, ptrW, ptrH);
        if (!ok) return;

        const i32 = new Int32Array(quadroChalk.memory.buffer);
        const nodeX = i32[ptrX >> 2];
        const nodeY = i32[ptrY >> 2];
        const nodeW = i32[ptrW >> 2];
        const nodeH = i32[ptrH >> 2];

        // Scoped GFX object with local coordinates relative to the module box
        const gfx = {
            width: nodeW,
            height: nodeH,
            fillRect: (x, y, w, h, color) => {
                quadroChalk.quadro_chalk_draw_rect(nodeX + x, nodeY + y, w, h, color);
            },
            strokeLine: (x0, y0, x1, y1, width, color) => {
                quadroChalk.quadro_chalk_draw_line(nodeX + x0, nodeY + y0, nodeX + x1, nodeY + y1, width, color);
            },
            drawCircle: (cx, cy, radius, color, filled = true) => {
                quadroChalk.quadro_chalk_draw_circle(nodeX + cx, nodeY + cy, radius, color, filled ? 1 : 0);
            },
            text: (x, y, str, color = 0xFFffffff, scale = 1) => {
                const sPtr = writeWasmString(str);
                quadroChalk.quadro_chalk_draw_text_cmd(nodeX + x, nodeY + y, sPtr, color, scale);
            },
            pixel: (x, y, color) => {
                quadroChalk.quadro_chalk_draw_pixel(nodeX + x, nodeY + y, color);
            },
            scope: (x, y, w, h, samples, color = 0xFF1dd1a1) => {
                if (!samples || samples.length === 0) return;
                const midY = nodeY + y + Math.floor(h / 2);
                let prevX = nodeX + x;
                let prevY = midY;
                const count = Math.min(samples.length, w);
                for (let s = 0; s < count; s++) {
                    const px = nodeX + x + Math.floor((s * w) / count);
                    const py = midY - Math.floor(samples[s] * (h / 2 - 2));
                    quadroChalk.quadro_chalk_draw_line(prevX, prevY, px, py, 1, color);
                    prevX = px;
                    prevY = py;
                }
            }
        };

        try {
            this.compiledModule.draw.call(this.state, gfx);
        } catch (err) {
            console.warn(`[Module ${this.id} Draw Error]:`, err);
        }
    }
}
