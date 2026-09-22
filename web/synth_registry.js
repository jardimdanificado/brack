/**
 * =========================================================================
 * BRACK Unified Synthesizer Module Registry (web/synth_registry.js)
 * Clean Modular DSP Architecture (48kHz Real-Time Audio Engine)
 * =========================================================================
 */

export const CATEGORIES = {
    VARIABLES: { id: "VARIABLES", name: "Variáveis & Listas", colour: "#FF661A" },
    ROUTING: { id: "ROUTING", name: "Barramentos de Áudio", colour: "#FF6680" },
    CONTROL: { id: "CONTROL", name: "Controle & Lógica", colour: "#FFAB19" },
    EVENTS: { id: "EVENTS", name: "Eventos & Clock", colour: "#FFBF00" },
    GENERATORS: { id: "GENERATORS", name: "Geradores", colour: "#9966FF" },
    FILTERS: { id: "FILTERS", name: "Filtros & Dinâmica", colour: "#FF8C1A" },
    MODULATORS: { id: "MODULATORS", name: "Moduladores", colour: "#59C059" },
    OPERATORS: { id: "OPERATORS", name: "Operadores & Matemática", colour: "#40C057" },
    EFFECTS: { id: "EFFECTS", name: "Efeitos & Saída", colour: "#4C97FF" }
};

export const MODULE_REGISTRY = new Map();

export function defineModule(spec) {
    MODULE_REGISTRY.set(spec.id, spec);
    return spec;
}

/* =========================================================================
 * DSP Mathematical & Synthesis Helpers (PolyBLEP, Moog, SVF, Reverb, Waveshapers)
 * ========================================================================= */
export const dspHelpers = {
    clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    },
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    parseNoteToMidi(token) {
        if (typeof token === 'number') return token;
        const s = String(token).trim().toLowerCase();
        if (!isNaN(Number(s))) return Number(s);

        const NOTE_MAP = {
            'c': 0, 'do': 0, 'dó': 0,
            'c#': 1, 'db': 1, 'do#': 1, 'dó#': 1,
            'd': 2, 're': 2, 'ré': 2,
            'd#': 3, 'eb': 3, 're#': 3, 'ré#': 3,
            'e': 4, 'mi': 4,
            'f': 5, 'fa': 5, 'fá': 5,
            'f#': 6, 'gb': 6, 'fa#': 6, 'fá#': 6,
            'g': 7, 'sol': 7,
            'g#': 8, 'ab': 8, 'sol#': 8,
            'a': 9, 'la': 9, 'lá': 9,
            'a#': 10, 'bb': 10, 'la#': 10, 'lá#': 10,
            'b': 11, 'si': 11
        };

        const match = s.match(/^([a-g]|do|dó|re|ré|mi|fa|fá|sol|la|lá|si)(#|b|♯|♭)?(-?\d+)?$/i);
        if (!match) return 0;

        let key = match[1];
        if (match[2]) {
            const acc = match[2] === '♯' ? '#' : (match[2] === '♭' ? 'b' : match[2]);
            key += acc;
        }
        const noteBase = NOTE_MAP[key];
        if (noteBase === undefined) return 0;

        const octave = match[3] !== undefined ? parseInt(match[3], 10) : 4;
        return (octave + 1) * 12 + noteBase;
    },
    tanh(x) {
        if (x < -3) return -1;
        if (x > 3) return 1;
        return x * (27 + x * x) / (27 + 9 * x * x);
    },
    blep(t, dt) {
        if (t < dt) {
            t /= dt;
            return t + t - t * t - 1.0;
        } else if (t > 1.0 - dt) {
            t = (t - 1.0) / dt;
            return t * t + t + t + 1.0;
        }
        return 0.0;
    },
    saw(phase, dt) {
        let val = 2.0 * phase - 1.0;
        val -= this.blep(phase, dt);
        return val;
    },
    sqr(phase, pw, dt) {
        let val = phase < pw ? 1.0 : -1.0;
        val += this.blep(phase, dt);
        val -= this.blep((phase + 1.0 - pw) % 1.0, dt);
        return val;
    },
    tri(phase) {
        let val = 2.0 * phase - 1.0;
        return 2.0 * (Math.abs(val) - 0.5);
    },
    voct(cv, baseFreq = 440) {
        return baseFreq * Math.pow(2.0, cv);
    },
    mtof(note) {
        return 440.0 * Math.pow(2.0, (note - 69.0) / 12.0);
    },
    ftom(freq) {
        if (freq <= 0) return 0;
        return 69.0 + 12.0 * Math.log2(freq / 440.0);
    },
    moogLadder(inSmp, cutoffHz, res, state, sampleRate = 48000) {
        const f = this.clamp((2.0 * cutoffHz) / sampleRate, 0.001, 0.98);
        const k = 3.6 * f - 1.6 * f * f - 1.0;
        const p = (k + 1.0) * 0.5;
        const scale = Math.exp((1.0 - p) * 1.386249);
        const r = res * scale;

        const x = inSmp - r * state[3];
        state[0] = this.tanh(state[0] + p * (this.tanh(x) - state[0]));
        state[1] = this.tanh(state[1] + p * (state[0] - state[1]));
        state[2] = this.tanh(state[2] + p * (state[1] - state[2]));
        state[3] = this.tanh(state[3] + p * (state[2] - state[3]));

        return state[3];
    },
    svf(inSmp, cutoffHz, res, state, sampleRate = 48000) {
        const normCutoff = this.clamp(cutoffHz / sampleRate, 0.0005, 0.49);
        const f = 2.0 * Math.sin(Math.PI * normCutoff);
        const q = 1.0 - this.clamp(res, 0.0, 0.98);

        const hp = inSmp - state.lp - q * state.bp;
        state.bp += f * hp;
        state.lp += f * state.bp;
        const notch = hp + state.lp;
        const peak = state.lp - hp;

        return { lp: state.lp, hp, bp: state.bp, notch, peak };
    }
};

/* =========================================================================
 * 1. GENERATORS
 * ========================================================================= */
defineModule({
    id: 'synth_vco',
    name: 'Oscilador VCO',
    category: 'GENERATORS',
    shape: 'statement',
    inputs: [
        { id: 'WAVE', label: 'Forma de Onda', type: 'dropdown', options: [
            ['Dente de Serra (Saw)', 'saw'],
            ['Quadrada (Square)', 'sqr'],
            ['Triangular (Triangle)', 'tri'],
            ['Senoidal (Sine)', 'sin'],
            ['Ruído Branco (Noise)', 'noise']
        ], default: 'saw' },
        { id: 'FREQ', label: 'Frequência Base (Hz)', type: 'val', default: 130.81 },
        { id: 'FM', label: 'Modulação FM (CV)', type: 'val', default: 0 },
        { id: 'PW', label: 'Largura Pulso PW (0..1)', type: 'val', default: 0.5 }
    ],
    state: () => ({ phase: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const freqRes = inputs.FREQ;
        const fmRes = inputs.FM;
        const pwRes = inputs.PW;
        const wave = inputs.WAVE;
        const pw = pwRes ? pwRes.val : 0.5;

        for (let s = 0; s < numSamples; s++) {
            const baseFreq = freqRes.audio ? freqRes.audio[s] : freqRes.val;
            const fm = fmRes ? (fmRes.audio ? fmRes.audio[s] : fmRes.val) : 0;
            const actualFreq = fm !== 0 ? dsp.voct(fm, baseFreq) : baseFreq;
            const dt = Math.max(0.0001, actualFreq) / 48000;

            let smp = 0;
            if (wave === 'saw') smp = dsp.saw(state.phase, dt);
            else if (wave === 'sqr') smp = dsp.sqr(state.phase, pw, dt);
            else if (wave === 'tri') smp = dsp.tri(state.phase);
            else if (wave === 'sin') smp = Math.sin(state.phase * 2 * Math.PI);
            else if (wave === 'noise') smp = (Math.random() * 2 - 1);

            state.audioBuf[s] = smp;
            state.phase = (state.phase + dt) % 1;
            if (state.phase < 0) state.phase += 1;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Oscilador analógico PolyBLEP anti-aliased com modulação FM contínua.'
});

defineModule({
    id: 'synth_noise',
    name: 'Gerador de Ruído',
    category: 'GENERATORS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'TYPE', label: 'Tipo de Ruído', type: 'dropdown', options: [
            ['Branco (White)', 'white'],
            ['Rosa (Pink)', 'pink'],
            ['Marrom (Brown/Red)', 'brown']
        ], default: 'white' },
        { id: 'GAIN', label: 'Ganho / Volume', type: 'val', default: 1.0 }
    ],
    state: () => ({ b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0, brown: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const type = inputs.TYPE;
        const gain = inputs.GAIN ? inputs.GAIN.val : 1.0;

        for (let s = 0; s < numSamples; s++) {
            const inSmp = inRes && inRes.audio ? inRes.audio[s] : 0;
            const white = Math.random() * 2 - 1;
            let smp = white;

            if (type === 'pink') {
                state.b0 = 0.99886 * state.b0 + white * 0.0555179;
                state.b1 = 0.99332 * state.b1 + white * 0.0750759;
                state.b2 = 0.96900 * state.b2 + white * 0.1538520;
                state.b3 = 0.86650 * state.b3 + white * 0.3104856;
                state.b4 = 0.55000 * state.b4 + white * 0.5329522;
                state.b5 = -0.7616 * state.b5 - white * 0.0168980;
                smp = (state.b0 + state.b1 + state.b2 + state.b3 + state.b4 + state.b5 + state.b6 + white * 0.5362) * 0.11;
                state.b6 = white * 0.115926;
            } else if (type === 'brown') {
                state.brown = (state.brown + 0.04 * white) / 1.04;
                smp = state.brown * 3.5;
            }

            state.audioBuf[s] = dsp.clamp(inSmp + smp * gain, -1, 1);
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Fonte de ruído branco, rosa (1/f) ou marrom/vermelho (1/f²).'
});

defineModule({
    id: 'synth_sub_osc',
    name: 'Sub-Oscilador',
    category: 'GENERATORS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'OCT', label: 'Sub-Oitava', type: 'dropdown', options: [
            ['-1 Oitava (Square)', '-1_sqr'],
            ['-1 Oitava (Sine)', '-1_sin'],
            ['-2 Oitavas (Square)', '-2_sqr'],
            ['-2 Oitavas (Sine)', '-2_sin']
        ], default: '-1_sqr' },
        { id: 'FREQ', label: 'Frequência Fundamental (Hz)', type: 'val', default: 130.81 },
        { id: 'VOL', label: 'Nível (0..1)', type: 'val', default: 0.8 }
    ],
    state: () => ({ phase: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const oct = inputs.OCT;
        const freqRes = inputs.FREQ;
        const vol = inputs.VOL ? inputs.VOL.val : 0.8;
        const div = oct.startsWith('-2') ? 4 : 2;
        const isSine = oct.includes('sin');

        for (let s = 0; s < numSamples; s++) {
            const inSmp = inRes && inRes.audio ? inRes.audio[s] : 0;
            const baseFreq = freqRes.audio ? freqRes.audio[s] : freqRes.val;
            const actualFreq = Math.max(1, baseFreq / div);
            const dt = actualFreq / 48000;

            const smp = isSine ? Math.sin(state.phase * 2 * Math.PI) : (state.phase < 0.5 ? 1 : -1);
            state.audioBuf[s] = inSmp + smp * vol;
            state.phase = (state.phase + dt) % 1;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Sub-oscilador para reforço de graves e peso analógico.'
});

defineModule({
    id: 'synth_bytebeat',
    name: 'Bytebeat 8-Bit',
    category: 'GENERATORS',
    shape: 'statement',
    inputs: [
        { id: 'FORMULA', label: 'Algoritmo', type: 'dropdown', options: [
            ["t * ((t>>12|t>>8)&63&t>>4)", "0"],
            ["(t>>7|t|t>>6)*10", "1"],
            ["(t*(t>>5|t>>8))>>(t>>16)", "2"],
            ["(t*5&t>>7)|(t*3&t>>10)", "3"]
        ], default: '0' },
        { id: 'SPEED', label: 'Taxa de Execução (Hz)', type: 'val', default: 8000 }
    ],
    state: () => ({ t: 0, phase: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const formula = inputs.FORMULA;
        const speedRes = inputs.SPEED;
        const speed = Math.max(100, speedRes.val);

        for (let s = 0; s < numSamples; s++) {
            state.phase += speed / 48000;
            if (state.phase >= 1.0) {
                state.t = (state.t + 1) | 0;
                state.phase -= 1.0;
            }
            const t = state.t;
            let rawByte = 0;
            if (formula === '0') rawByte = (t * ((t >> 12 | t >> 8) & 63 & (t >> 4))) & 255;
            else if (formula === '1') rawByte = ((t >> 7 | t | t >> 6) * 10) & 255;
            else if (formula === '2') rawByte = ((t * (t >> 5 | t >> 8)) >> (t >> 16)) & 255;
            else if (formula === '3') rawByte = ((t * 5 & (t >> 7)) | (t * 3 & (t >> 10))) & 255;

            state.audioBuf[s] = (rawByte / 127.5) - 1.0;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Síntese algorítmica matemática chiptune 8-bit.'
});

/* =========================================================================
 * 2. FILTERS & DYNAMICS
 * ========================================================================= */
defineModule({
    id: 'synth_vcf',
    name: 'Filtro Moog 24dB VCF',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'CUTOFF', label: 'Corte Cutoff (Hz ou CV)', type: 'val', default: 800 },
        { id: 'RES', label: 'Ressonância (0..0.95)', type: 'val', default: 0.5 }
    ],
    state: () => ({ moog: [0, 0, 0, 0], audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const cutoffRes = inputs.CUTOFF;
        const resRes = inputs.RES;
        const resVal = dsp.clamp(resRes.val, 0, 0.95);

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const rawCutoff = cutoffRes.audio ? cutoffRes.audio[s] : cutoffRes.val;
            const cutoffHz = rawCutoff < 12 ? dsp.voct(rawCutoff, 440) : rawCutoff;
            state.audioBuf[s] = dsp.moogLadder(inRes.audio[s], cutoffHz, resVal, state.moog, 48000);
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Filtro transistor ladder 4-polos com saturação analógica e auto-oscilação.'
});

defineModule({
    id: 'synth_svf',
    name: 'Filtro Multimodo SVF 12dB',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'MODE', label: 'Modo de Resposta', type: 'dropdown', options: [
            ['Passa-Baixas (Lowpass)', 'lp'],
            ['Passa-Altas (Highpass)', 'hp'],
            ['Passa-Faixa (Bandpass)', 'bp'],
            ['Rejeita-Faixa (Notch)', 'notch']
        ], default: 'lp' },
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'CUTOFF', label: 'Frequência de Corte (Hz)', type: 'val', default: 1200 },
        { id: 'RES', label: 'Ressonância Q (0..0.95)', type: 'val', default: 0.5 }
    ],
    state: () => ({ lp: 0, bp: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const mode = inputs.MODE;
        const cutoffRes = inputs.CUTOFF;
        const resRes = inputs.RES;
        const resVal = dsp.clamp(resRes ? resRes.val : 0.5, 0, 0.95);

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const rawCutoff = cutoffRes.audio ? cutoffRes.audio[s] : cutoffRes.val;
            const cutoffHz = rawCutoff < 12 ? dsp.voct(rawCutoff, 440) : rawCutoff;
            const outSvf = dsp.svf(inRes.audio[s], cutoffHz, resVal, state, 48000);
            state.audioBuf[s] = outSvf[mode] || outSvf.lp;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Filtro State-Variable com 4 saídas de resposta de frequência simultâneas.'
});

defineModule({
    id: 'synth_vca',
    name: 'Amplificador VCA',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'EXP', label: 'Resposta de Curva', type: 'dropdown', options: [
            ['Exponencial (Áudio)', '1'],
            ['Linear (Modulação CV)', '0']
        ], default: '1' },
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'GAIN', label: 'Ganho / Modulação (CV)', type: 'val', default: 1 }
    ],
    state: () => ({ audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const gainRes = inputs.GAIN;
        const isExp = inputs.EXP === '1';

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const g = gainRes.audio ? gainRes.audio[s] : gainRes.val;
            const actualGain = isExp ? Math.pow(dsp.clamp(g, 0, 1), 2) : dsp.clamp(g, 0, 2);
            state.audioBuf[s] = inRes.audio[s] * actualGain;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Amplificador controlado por voltagem com curva exponencial ou linear.'
});

defineModule({
    id: 'synth_distortion',
    name: 'Saturação & Distorção',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'MODE', label: 'Tipo de Distorção', type: 'dropdown', options: [
            ['Saturação Analógica (Tanh)', 'tanh'],
            ['Hard Clip (Ceifamento Digital)', 'hard'],
            ['Bitcrusher Lo-Fi', 'crush'],
            ['Wavefolder (Dobra Harmônica)', 'fold']
        ], default: 'tanh' },
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'DRIVE', label: 'Drive / Ganho (1..20)', type: 'val', default: 3 }
    ],
    state: () => ({ audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const driveRes = inputs.DRIVE;
        const mode = inputs.MODE;
        const drive = Math.max(1, driveRes.val);

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const x = inRes.audio[s] * drive;
            let outSmp = x;
            if (mode === 'tanh') outSmp = dsp.tanh(x);
            else if (mode === 'hard') outSmp = dsp.clamp(x, -1, 1);
            else if (mode === 'crush') {
                const step = 0.125;
                outSmp = Math.round(dsp.clamp(x, -1, 1) / step) * step;
            } else if (mode === 'fold') {
                let f = x;
                while (f > 1 || f < -1) {
                    if (f > 1) f = 2 - f;
                    else if (f < -1) f = -2 - f;
                }
                outSmp = f;
            }
            state.audioBuf[s] = outSmp;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Efeito de saturação valvulada, clipping, redução de bits ou dobra harmônica.'
});

defineModule({
    id: 'synth_ringmod',
    name: 'Ring Modulator',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'CARRIER', label: 'Portadora Carrier (ou fluxo acima)', type: 'audio' },
        { id: 'MOD', label: 'Modulador Mod In', type: 'val', default: 1.0 },
        { id: 'MIX', label: 'Mix Seco/Molhado (0..1)', type: 'val', default: 1.0 }
    ],
    state: () => ({ audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const carRes = inputs.CARRIER;
        const modRes = inputs.MOD;
        const mix = inputs.MIX ? inputs.MIX.val : 1.0;

        if (!carRes || !carRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const car = carRes.audio[s];
            const mod = modRes ? (modRes.audio ? modRes.audio[s] : (modRes.val !== undefined ? modRes.val : 1.0)) : 1.0;
            const wet = car * mod;
            state.audioBuf[s] = car * (1 - mix) + wet * mix;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Multiplicação balanceada de 4 quadrantes para timbres metálicos e robóticos.'
});

defineModule({
    id: 'synth_compressor',
    name: 'Compressor Dinâmico',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'THRESH', label: 'Limiar Threshold (0..1)', type: 'val', default: 0.5 },
        { id: 'RATIO', label: 'Razão Ratio (1..20)', type: 'val', default: 4 },
        { id: 'MAKEUP', label: 'Ganho Makeup', type: 'val', default: 1.2 }
    ],
    state: () => ({ env: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const thresh = inputs.THRESH ? inputs.THRESH.val : 0.5;
        const ratio = Math.max(1, inputs.RATIO ? inputs.RATIO.val : 4);
        const makeup = inputs.MAKEUP ? inputs.MAKEUP.val : 1.2;

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const inSmp = inRes.audio[s];
            const absSmp = Math.abs(inSmp);
            state.env += (absSmp - state.env) * 0.05;

            let gain = 1.0;
            if (state.env > thresh) {
                const over = state.env - thresh;
                const compressed = thresh + over / ratio;
                gain = compressed / (state.env + 0.0001);
            }
            state.audioBuf[s] = inSmp * gain * makeup;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Controle de dinâmica para nivelamento, punch e limitação de picos.'
});

defineModule({
    id: 'synth_mixer',
    name: 'Mixer 2 Canais',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'IN1', label: 'Canal 1 (ou fluxo acima)', type: 'audio' },
        { id: 'VOL1', label: 'Volume 1 (0..2)', type: 'val', default: 1.0 },
        { id: 'IN2', label: 'Canal 2', type: 'val', default: 0 },
        { id: 'VOL2', label: 'Volume 2 (0..2)', type: 'val', default: 1.0 }
    ],
    state: () => ({ audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const in1 = inputs.IN1;
        const v1 = inputs.VOL1 ? inputs.VOL1.val : 1.0;
        const in2 = inputs.IN2;
        const v2 = inputs.VOL2 ? inputs.VOL2.val : 1.0;

        for (let s = 0; s < numSamples; s++) {
            const s1 = in1 ? (in1.audio ? in1.audio[s] : in1.val) : 0;
            const s2 = in2 ? (in2.audio ? in2.audio[s] : in2.val) : 0;
            state.audioBuf[s] = s1 * v1 + s2 * v2;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Soma e balanceia 2 sinais de áudio ou voltagens de controle.'
});

defineModule({
    id: 'synth_mixer4',
    name: 'Mixer 4 Canais',
    category: 'FILTERS',
    shape: 'statement',
    inputs: [
        { id: 'IN1', label: 'Canal 1 (ou fluxo acima)', type: 'audio' },
        { id: 'VOL1', label: 'Vol 1', type: 'val', default: 1.0 },
        { id: 'IN2', label: 'Canal 2', type: 'val', default: 0 },
        { id: 'VOL2', label: 'Vol 2', type: 'val', default: 1.0 },
        { id: 'IN3', label: 'Canal 3', type: 'val', default: 0 },
        { id: 'VOL3', label: 'Vol 3', type: 'val', default: 1.0 },
        { id: 'IN4', label: 'Canal 4', type: 'val', default: 0 },
        { id: 'VOL4', label: 'Vol 4', type: 'val', default: 1.0 }
    ],
    state: () => ({ audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const in1 = inputs.IN1, v1 = inputs.VOL1 ? inputs.VOL1.val : 1.0;
        const in2 = inputs.IN2, v2 = inputs.VOL2 ? inputs.VOL2.val : 1.0;
        const in3 = inputs.IN3, v3 = inputs.VOL3 ? inputs.VOL3.val : 1.0;
        const in4 = inputs.IN4, v4 = inputs.VOL4 ? inputs.VOL4.val : 1.0;

        for (let s = 0; s < numSamples; s++) {
            const s1 = in1 ? (in1.audio ? in1.audio[s] : in1.val) : 0;
            const s2 = in2 ? (in2.audio ? in2.audio[s] : in2.val) : 0;
            const s3 = in3 ? (in3.audio ? in3.audio[s] : in3.val) : 0;
            const s4 = in4 ? (in4.audio ? in4.audio[s] : in4.val) : 0;
            state.audioBuf[s] = s1 * v1 + s2 * v2 + s3 * v3 + s4 * v4;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Mixer e somador utilitário com 4 canais independentes.'
});

/* =========================================================================
 * 3. MODULATORS & CONTROL
 * ========================================================================= */
defineModule({
    id: 'synth_adsr',
    name: 'Envelope ADSR',
    category: 'MODULATORS',
    shape: 'value',
    inputs: [
        { id: 'GATE', label: 'Gate / Disparo', type: 'val', default: 0 },
        { id: 'A', label: 'Ataque (s)', type: 'val', default: 0.02 },
        { id: 'D', label: 'Decaimento (s)', type: 'val', default: 0.15 },
        { id: 'S', label: 'Sustain (0..1)', type: 'val', default: 0.4 },
        { id: 'R', label: 'Release (s)', type: 'val', default: 0.25 }
    ],
    state: () => ({ level: 0, stage: 0, lastGate: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const gateRes = inputs.GATE;
        const aVal = Math.max(0.001, inputs.A.val);
        const dVal = Math.max(0.001, inputs.D.val);
        const sVal = dsp.clamp(inputs.S.val, 0, 1);
        const rVal = Math.max(0.001, inputs.R.val);

        for (let s = 0; s < numSamples; s++) {
            const gate = gateRes ? (gateRes.audio ? gateRes.audio[s] : gateRes.val) : 0;
            if (gate > 0.5 && state.lastGate <= 0.5) state.stage = 1;
            if (gate <= 0.5 && state.lastGate > 0.5) state.stage = 4;
            state.lastGate = gate;

            if (state.stage === 1) {
                state.level += (1.0 - state.level) / (aVal * 48000 * 0.35);
                if (state.level >= 0.99) { state.level = 1.0; state.stage = 2; }
            } else if (state.stage === 2) {
                state.level += (sVal - state.level) / (dVal * 48000 * 0.35);
                if (Math.abs(state.level - sVal) < 0.01) { state.level = sVal; state.stage = 3; }
            } else if (state.stage === 3) {
                state.level = sVal;
            } else if (state.stage === 4) {
                state.level += (0 - state.level) / (rVal * 48000 * 0.35);
                if (state.level < 0.001) { state.level = 0; state.stage = 0; }
            }
            state.audioBuf[s] = state.level;
        }
        return { type: 'AUDIO', val: state.level, audio: state.audioBuf };
    },
    tooltip: 'Envelope ADSR analógico exponencial para articulação e amplitude.'
});

defineModule({
    id: 'synth_lfo',
    name: 'LFO Modulador',
    category: 'MODULATORS',
    shape: 'value',
    inputs: [
        { id: 'WAVE', label: 'Forma de Onda', type: 'dropdown', options: [
            ['Triangular', 'tri'],
            ['Senoidal', 'sin'],
            ['Quadrada', 'sqr'],
            ['Dente de Serra', 'saw'],
            ['Aleatória (S&H)', 'rand']
        ], default: 'tri' },
        { id: 'FREQ', label: 'Frequência (Hz)', type: 'val', default: 2.0 },
        { id: 'DEPTH', label: 'Profundidade / Ganho', type: 'val', default: 1.0 }
    ],
    state: () => ({ phase: 0, sampleHold: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const wave = inputs.WAVE;
        const freqRes = inputs.FREQ;
        const depthRes = inputs.DEPTH;

        const freq = Math.max(0.01, freqRes.val);
        const depth = depthRes.val;
        const dt = freq / 48000;

        for (let s = 0; s < numSamples; s++) {
            let val = 0;
            if (wave === 'tri') val = dsp.tri(state.phase);
            else if (wave === 'sin') val = Math.sin(state.phase * 2 * Math.PI);
            else if (wave === 'sqr') val = state.phase < 0.5 ? 1 : -1;
            else if (wave === 'saw') val = state.phase * 2 - 1;
            else if (wave === 'rand') {
                if (state.phase < dt) state.sampleHold = Math.random() * 2 - 1;
                val = state.sampleHold;
            }
            state.phase = (state.phase + dt) % 1;
            state.audioBuf[s] = val * depth;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Oscilador de Baixa Frequência para vibrato, tremolo, sweeps e modulações.'
});

defineModule({
    id: 'synth_sample_hold',
    name: 'Sample & Hold',
    category: 'MODULATORS',
    shape: 'value',
    inputs: [
        { id: 'SIG', label: 'Sinal In (ou Ruído)', type: 'val', default: 0 },
        { id: 'TRIG', label: 'Disparo Trigger / Clock', type: 'val', default: 0 }
    ],
    state: () => ({ latchedVal: 0, lastTrig: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const sigRes = inputs.SIG;
        const trigRes = inputs.TRIG;

        for (let s = 0; s < numSamples; s++) {
            const trig = trigRes ? (trigRes.audio ? trigRes.audio[s] : trigRes.val) : 0;
            if (trig > 0.5 && state.lastTrig <= 0.5) {
                state.latchedVal = sigRes ? (sigRes.audio ? sigRes.audio[s] : sigRes.val) : (Math.random() * 2 - 1);
            }
            state.lastTrig = trig;
            state.audioBuf[s] = state.latchedVal;
        }
        return { type: 'AUDIO', val: state.latchedVal, audio: state.audioBuf };
    },
    tooltip: 'Congela e mantém a voltagem de entrada a cada pulso de subida.'
});

defineModule({
    id: 'synth_slew',
    name: 'Slew Limiter (Portamento / Glide)',
    category: 'MODULATORS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Sinal CV In', type: 'val', default: 0 },
        { id: 'TIME', label: 'Tempo de Glide (s)', type: 'val', default: 0.1 }
    ],
    state: () => ({ currentVal: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const time = Math.max(0.001, inputs.TIME ? inputs.TIME.val : 0.1);
        const coef = 1.0 - Math.exp(-1.0 / (time * 48000));

        for (let s = 0; s < numSamples; s++) {
            const target = inRes ? (inRes.audio ? inRes.audio[s] : inRes.val) : 0;
            state.currentVal += (target - state.currentVal) * coef;
            state.audioBuf[s] = state.currentVal;
        }
        return { type: 'AUDIO', val: state.currentVal, audio: state.audioBuf };
    },
    tooltip: 'Suaviza saltos abruptos de voltagem criando portamento entre notas.'
});

defineModule({
    id: 'synth_attenuverter',
    name: 'Atenuador & Offset CV',
    category: 'MODULATORS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Sinal In', type: 'val', default: 0 },
        { id: 'SCALE', label: 'Escala / Inversão (-2..2)', type: 'val', default: 1.0 },
        { id: 'OFFSET', label: 'Deslocamento Offset (-5..5)', type: 'val', default: 0.0 }
    ],
    state: () => ({ audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const scale = inputs.SCALE ? inputs.SCALE.val : 1.0;
        const offset = inputs.OFFSET ? inputs.OFFSET.val : 0.0;

        for (let s = 0; s < numSamples; s++) {
            const val = inRes ? (inRes.audio ? inRes.audio[s] : inRes.val) : 0;
            state.audioBuf[s] = val * scale + offset;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Multiplica, inverte de fase e adiciona offset de voltagem contínua.'
});

/* =========================================================================
 * 4. EFFECTS & MASTER OUT
 * ========================================================================= */
defineModule({
    id: 'synth_reverb',
    name: 'Reverb Espacial',
    category: 'EFFECTS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'SIZE', label: 'Tamanho da Sala (0..1)', type: 'val', default: 0.7 },
        { id: 'DAMP', label: 'Amortecimento Damping', type: 'val', default: 0.4 },
        { id: 'MIX', label: 'Mix Wet (0..1)', type: 'val', default: 0.35 }
    ],
    state: () => ({
        c1: new Float32Array(1557), c1Head: 0, c1Filt: 0,
        c2: new Float32Array(1617), c2Head: 0, c2Filt: 0,
        c3: new Float32Array(1491), c3Head: 0, c3Filt: 0,
        c4: new Float32Array(1422), c4Head: 0, c4Filt: 0,
        ap1: new Float32Array(225), ap1Head: 0,
        ap2: new Float32Array(556), ap2Head: 0,
        audioBuf: new Float32Array(128)
    }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const size = dsp.clamp(inputs.SIZE ? inputs.SIZE.val : 0.7, 0.1, 0.95);
        const damp = dsp.clamp(inputs.DAMP ? inputs.DAMP.val : 0.4, 0.05, 0.95);
        const mix = dsp.clamp(inputs.MIX ? inputs.MIX.val : 0.35, 0, 1);

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const inSmp = inRes.audio[s];

            // 4 parallel feedback comb filters
            const c1Out = state.c1[state.c1Head];
            state.c1Filt = c1Out * (1 - damp) + state.c1Filt * damp;
            state.c1[state.c1Head] = inSmp + state.c1Filt * size;
            state.c1Head = (state.c1Head + 1) % 1557;

            const c2Out = state.c2[state.c2Head];
            state.c2Filt = c2Out * (1 - damp) + state.c2Filt * damp;
            state.c2[state.c2Head] = inSmp + state.c2Filt * size;
            state.c2Head = (state.c2Head + 1) % 1617;

            const c3Out = state.c3[state.c3Head];
            state.c3Filt = c3Out * (1 - damp) + state.c3Filt * damp;
            state.c3[state.c3Head] = inSmp + state.c3Filt * size;
            state.c3Head = (state.c3Head + 1) % 1491;

            const c4Out = state.c4[state.c4Head];
            state.c4Filt = c4Out * (1 - damp) + state.c4Filt * damp;
            state.c4[state.c4Head] = inSmp + state.c4Filt * size;
            state.c4Head = (state.c4Head + 1) % 1422;

            let outComb = (c1Out + c2Out + c3Out + c4Out) * 0.25;

            // 2 allpass diffusers
            const ap1Del = state.ap1[state.ap1Head];
            const ap1In = outComb + ap1Del * 0.5;
            state.ap1[state.ap1Head] = ap1In;
            outComb = -ap1In * 0.5 + ap1Del;
            state.ap1Head = (state.ap1Head + 1) % 225;

            const ap2Del = state.ap2[state.ap2Head];
            const ap2In = outComb + ap2Del * 0.5;
            state.ap2[state.ap2Head] = ap2In;
            outComb = -ap2In * 0.5 + ap2Del;
            state.ap2Head = (state.ap2Head + 1) % 556;

            state.audioBuf[s] = inSmp * (1 - mix) + outComb * mix;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Reverberador espacial estéreo com difusão acústica natural.'
});

defineModule({
    id: 'synth_chorus',
    name: 'Chorus Analógico',
    category: 'EFFECTS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'RATE', label: 'Velocidade (Hz)', type: 'val', default: 1.2 },
        { id: 'DEPTH', label: 'Profundidade (0..1)', type: 'val', default: 0.6 },
        { id: 'MIX', label: 'Mix Wet', type: 'val', default: 0.5 }
    ],
    state: () => ({ buf: new Float32Array(4800), head: 0, lfoPhase: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const rate = Math.max(0.1, inputs.RATE.val);
        const depth = dsp.clamp(inputs.DEPTH.val, 0, 1);
        const mix = dsp.clamp(inputs.MIX.val, 0, 1);

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const inSmp = inRes.audio[s];
            const mod = (Math.sin(state.lfoPhase * 2 * Math.PI) * 0.5 + 0.5) * depth * 250 + 200;
            state.lfoPhase = (state.lfoPhase + rate / 48000) % 1;

            state.buf[state.head] = inSmp;
            const rHead = (state.head - mod + 4800) % 4800;
            const idx0 = Math.floor(rHead);
            const frac = rHead - idx0;
            const wet = state.buf[idx0] * (1 - frac) + state.buf[(idx0 + 1) % 4800] * frac;

            state.head = (state.head + 1) % 4800;
            state.audioBuf[s] = inSmp * (1 - mix) + wet * mix;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Efeito de chorus analógico espacial estéreo/mono.'
});

defineModule({
    id: 'synth_scope',
    name: 'Osciloscópio Live',
    category: 'EFFECTS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' }
    ],
    state: () => ({
        audioBuf: new Float32Array(128),
        history: new Float32Array(512),
        histHead: 0
    }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const smp = inRes.audio[s];
            state.audioBuf[s] = smp;
            state.history[state.histHead] = smp;
            state.histHead = (state.histHead + 1) % 512;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Osciloscópio em tempo real que desenha a forma de onda do sinal de áudio.'
});

defineModule({
    id: 'synth_delay',
    name: 'Tape Delay Analógico',
    category: 'EFFECTS',
    shape: 'statement',
    inputs: [
        { id: 'IN', label: 'Áudio In (ou fluxo acima)', type: 'audio' },
        { id: 'TIME', label: 'Tempo (s)', type: 'val', default: 0.35 },
        { id: 'FEEDBACK', label: 'Feedback (0..0.95)', type: 'val', default: 0.45 },
        { id: 'MIX', label: 'Mix Wet', type: 'val', default: 0.35 }
    ],
    state: () => ({ buf: new Float32Array(96000), head: 0, lpf: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const inRes = inputs.IN;
        const timeRes = inputs.TIME;
        const fbRes = inputs.FEEDBACK;
        const mixRes = inputs.MIX;

        const time = dsp.clamp(timeRes.val, 0.01, 1.95);
        const fb = dsp.clamp(fbRes.val, 0, 0.95);
        const mix = dsp.clamp(mixRes.val, 0, 1);
        const delaySamples = Math.floor(time * 48000);

        if (!inRes || !inRes.audio) {
            state.audioBuf.fill(0);
            return { type: 'AUDIO', val: 0, audio: state.audioBuf };
        }

        for (let s = 0; s < numSamples; s++) {
            const inSmp = inRes.audio[s];
            const readIdx = (state.head - delaySamples + 96000) % 96000;
            const delayed = state.buf[readIdx];
            state.lpf += 0.25 * (delayed - state.lpf);
            const saturated = dsp.tanh(state.lpf * 1.1);
            state.buf[state.head] = inSmp + saturated * fb;
            state.head = (state.head + 1) % 96000;
            state.audioBuf[s] = inSmp * (1 - mix) + saturated * mix;
        }
        return { type: 'AUDIO', val: state.audioBuf[0], audio: state.audioBuf };
    },
    tooltip: 'Efeito de delay analógico com saturação quente e rolloff.'
});

defineModule({
    id: 'synth_out',
    name: 'Saída Estéreo Master',
    category: 'EFFECTS',
    shape: 'statement_end',
    inputs: [
        { id: 'LEFT', label: 'Áudio L (opcional)', type: 'val' },
        { id: 'RIGHT', label: 'Áudio R (opcional)', type: 'val' },
        { id: 'VOL', label: 'Volume Master (0..1.5)', type: 'val', default: 0.85 }
    ],
    state: () => ({ outL: new Float32Array(128), outR: new Float32Array(128) }),
    tooltip: 'Saída final para os alto-falantes e fones de ouvido.'
});

/* =========================================================================
 * 5. EVENTS & CLOCKS
 * ========================================================================= */
defineModule({
    id: 'synth_clock',
    name: 'Clock Mestre',
    category: 'EVENTS',
    shape: 'statement',
    inputs: [
        { id: 'BPM', label: 'Tempo (BPM)', type: 'val', default: 120 },
        { id: 'PW', label: 'Largura Pulso (0..1)', type: 'val', default: 0.5 }
    ],
    state: () => ({ phase: 0, gate: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const bpm = Math.max(10, inputs.BPM.val);
        const pw = dsp.clamp(inputs.PW.val, 0.05, 0.95);
        const dt = (bpm / 60 * 2) / 48000;

        for (let s = 0; s < numSamples; s++) {
            state.phase = (state.phase + dt) % 1;
            state.gate = state.phase < pw ? 1 : 0;
            state.audioBuf[s] = state.gate;
        }
        return { type: 'VAL', val: state.gate, audio: state.audioBuf };
    },
    tooltip: 'Gera pulsos de clock rítmicos para sequenciadores e envelopes.'
});

defineModule({
    id: 'synth_clock_divider',
    name: 'Divisor de Clock',
    category: 'EVENTS',
    shape: 'statement',
    inputs: [
        { id: 'DIV', label: 'Divisão', type: 'dropdown', options: [
            ['/ 2 (Semínima)', '2'],
            ['/ 3 (Tercina)', '3'],
            ['/ 4 (Mínima)', '4'],
            ['/ 8 (Semibreve)', '8'],
            ['/ 16 (4 Compassos)', '16']
        ], default: '2' },
        { id: 'IN', label: 'Clock In (ou fluxo acima)', type: 'audio' }
    ],
    state: () => ({ count: 0, lastIn: 0, gate: 0, audioBuf: new Float32Array(128) }),
    process(inputs, state, dsp, numSamples) {
        const div = parseInt(inputs.DIV, 10) || 2;
        const inRes = inputs.IN;

        for (let s = 0; s < numSamples; s++) {
            const clk = inRes ? (inRes.audio ? inRes.audio[s] : inRes.val) : 0;
            if (clk > 0.5 && state.lastIn <= 0.5) {
                state.count = (state.count + 1) % div;
                state.gate = (state.count === 0) ? 1 : 0;
            } else if (clk <= 0.5) {
                state.gate = 0;
            }
            state.lastIn = clk;
            state.audioBuf[s] = state.gate;
        }
        return { type: 'VAL', val: state.gate, audio: state.audioBuf };
    },
    tooltip: 'Sub-divide o clock de entrada gerando tempos mais lentos e polirritmos.'
});

/* =========================================================================
 * Automatic Blockly Block Registration & Dynamic Toolbox
 * ========================================================================= */
export function registerAllBlocksToBlockly(Blockly) {
    if (!Blockly || !Blockly.Blocks) return;

    for (const [id, mod] of MODULE_REGISTRY) {
        Blockly.Blocks[id] = {
            init: function() {
                const headerInput = this.appendDummyInput();
                headerInput.appendField(mod.name);

                for (const inp of mod.inputs) {
                    if (inp.type === 'dropdown') {
                        headerInput.appendField(new Blockly.FieldDropdown(inp.options), inp.id);
                    } else if (inp.type === 'text') {
                        headerInput.appendField(new Blockly.FieldTextInput(inp.default || ''), inp.id);
                    } else if (inp.type === 'audio' || inp.type === 'val' || inp.type === 'num') {
                        const valIn = this.appendValueInput(inp.id).appendField(inp.label);
                        if (inp.check) valIn.setCheck(inp.check);
                    }
                }

                if (id === 'synth_scope') {
                    const placeholderSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='60'></svg>";
                    this.appendDummyInput('SCOPE_SLOT')
                        .appendField(new Blockly.FieldImage(placeholderSvg, 180, 60, "*"), "SCOPE_IMG");
                }

                const cat = CATEGORIES[mod.category] || CATEGORIES.GENERATORS;
                this.setColour(cat.colour);

                if (mod.shape === 'statement') {
                    this.setPreviousStatement(true, "AUDIO");
                    this.setNextStatement(true, "AUDIO");
                } else if (mod.shape === 'statement_end') {
                    this.setPreviousStatement(true, "AUDIO");
                } else if (mod.shape === 'value') {
                    this.setOutput(true);
                }

                this.setInputsInline(false);
                if (mod.tooltip) this.setTooltip(mod.tooltip);
            }
        };
    }
}
