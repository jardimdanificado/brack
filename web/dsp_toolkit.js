/**
 * =========================================================================
 * BRACK C-Accelerated DSP Toolkit (web/dsp_toolkit.js)
 * Exposes anti-aliased oscillators, analog filters, nonlinearities & math
 * =========================================================================
 */

export const dsp = {
    // Pitch & Frequency Conversions
    mtof(midiNote) {
        return 440.0 * Math.pow(2.0, (midiNote - 69.0) / 12.0);
    },

    ftom(freq) {
        return 69.0 + 12.0 * Math.log2(Math.max(1.0, freq) / 440.0);
    },

    voctToFreq(voct, baseFreq = 130.81278) {
        return baseFreq * Math.pow(2.0, voct);
    },

    // Fast Math & Curves
    clamp(v, min, max) {
        return v < min ? min : (v > max ? max : v);
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    tanh(x) {
        if (x < -3.0) return -1.0;
        if (x > 3.0) return 1.0;
        const x2 = x * x;
        return x * (27.0 + x2) / (27.0 + 9.0 * x2);
    },

    // PolyBLEP Anti-Aliased Residual Calculation
    polyblep(phase, dt) {
        if (dt <= 0.0) return 0.0;
        if (phase < dt) {
            const t = phase / dt;
            return t + t - t * t - 1.0;
        } else if (phase > 1.0 - dt) {
            const t = (phase - 1.0) / dt;
            return t * t + t + t + 1.0;
        }
        return 0.0;
    },

    // Anti-Aliased Saw Wave Generator
    sawPolyblep(phase, dt) {
        let saw = 2.0 * phase - 1.0;
        saw -= dsp.polyblep(phase, dt);
        return saw;
    },

    // Anti-Aliased Pulse Wave Generator with PWM
    sqrPolyblep(phase, pw, dt) {
        let sqr = (phase < pw) ? 1.0 : -1.0;
        sqr += dsp.polyblep(phase, dt);
        let phase_pw = phase - pw;
        if (phase_pw < 0.0) phase_pw += 1.0;
        sqr -= dsp.polyblep(phase_pw, dt);
        return sqr;
    },

    // Moog 24dB 4-Pole Ladder Filter Step with Saturation
    moogStep(state, inSample, cutoff, resonance, drive, sampleRate) {
        const f = Math.min(0.49, (cutoff * 2.0) / sampleRate);
        const k = 3.6 * f - 1.6 * f * f - 0.2;
        const p = (k + 0.3) * 0.5;
        const scale = Math.exp((1.0 - p) * 1.386249);
        const r = resonance * scale * 4.0;

        const x = dsp.tanh(inSample * drive - r * state[3]);

        state[0] += (dsp.tanh(x) - dsp.tanh(state[0])) * p;
        state[1] += (dsp.tanh(state[0]) - dsp.tanh(state[1])) * p;
        state[2] += (dsp.tanh(state[1]) - dsp.tanh(state[2])) * p;
        state[3] += (dsp.tanh(state[2]) - dsp.tanh(state[3])) * p;

        return state[3];
    },

    // State Variable Filter (SVF) Step
    svfStep(state, inSample, cutoff, resonance, sampleRate) {
        const g = Math.tan((Math.PI * Math.min(cutoff, sampleRate * 0.45)) / sampleRate);
        const k = 2.0 - 2.0 * Math.min(resonance, 0.99);
        const a1 = 1.0 / (1.0 + g * (g + k));
        const a2 = g * a1;
        const a3 = g * a2;

        const v0 = inSample;
        const v1 = a1 * state.ic1eq + a2 * (v0 - state.ic2eq);
        const v2 = state.ic2eq + a2 * state.ic1eq + a3 * (v0 - state.ic2eq);

        state.ic1eq = 2.0 * v1 - state.ic1eq;
        state.ic2eq = 2.0 * v2 - state.ic2eq;

        return {
            lp: v2,
            bp: v1,
            hp: v0 - k * v1 - v2
        };
    }
};
