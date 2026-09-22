#ifndef BRACK_DSP_H
#define BRACK_DSP_H

/**
 * =========================================================================
 * BRACK Reusable DSP Algorithms & Fast Math (include/brack_dsp.h)
 * Standard DSP Toolkit for Module Developers (Pure Freestanding C / No Libc)
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>

#define B_PI       3.14159265358979323846f
#define B_TWO_PI   6.28318530717958647692f
#define B_HALF_PI  1.57079632679489661923f

/* =========================================================================
 * Fast Math Primitives (Zero Libc)
 * ========================================================================= */

static inline float b_abs(float x) {
    union { float f; uint32_t u; } val;
    val.f = x;
    val.u &= 0x7FFFFFFF;
    return val.f;
}

static inline float b_clamp(float x, float min, float max) {
    if (x < min) return min;
    if (x > max) return max;
    return x;
}

static inline float b_lerp(float a, float b, float t) {
    return a + t * (b - a);
}

/** 4-Point Hermite cubic interpolation */
static inline float b_hermite(float y0, float y1, float y2, float y3, float frac) {
    float c0 = y1;
    float c1 = 0.5f * (y2 - y0);
    float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
    float c3 = 1.5f * (y1 - y2) + 0.5f * (y3 - y0);
    return ((c3 * frac + c2) * frac + c1) * frac + c0;
}

/** Normalized Sine where phase is in [0.0 .. 1.0] */
static inline float b_sin_norm(float phase) {
    float x = (phase - 0.5f) * B_TWO_PI;
    const float B = 4.0f / B_PI;
    const float C = -4.0f / (B_PI * B_PI);
    const float P = 0.225f;
    float y = B * x + C * x * b_abs(x);
    return P * (y * b_abs(y) - y) + y;
}

/** Fast base-2 exponential (2^x) */
static inline float b_exp2(float x) {
    if (x < -126.0f) return 0.0f;
    if (x > 126.0f) x = 126.0f;
    float clip = (x < -126.0f) ? -126.0f : x;
    int32_t i = (int32_t)(clip);
    float f = clip - (float)i;
    float p = 1.0f + f * (0.693017f + f * (0.241404f + f * 0.052032f));
    union { int32_t i; float f; } u;
    u.i = (i + 127) << 23;
    return p * u.f;
}

/** 1V/Octave to Frequency */
static inline float b_voct_to_freq(float voct, float base_freq) {
    return base_freq * b_exp2(voct);
}

/** Decibels to Linear Amplitude */
static inline float b_db_to_linear(float db) {
    return b_exp2(db * 0.16609640474f);
}

/** Analog Saturation / Soft-Clipper (Tanh Pade Approximant) */
static inline float b_tanh(float x) {
    if (x < -3.0f) return -1.0f;
    if (x > 3.0f) return 1.0f;
    float x2 = x * x;
    return x * (27.0f + x2) / (27.0f + 9.0f * x2);
}

/** PolyBLEP anti-aliasing residual */
static inline float b_polyblep(float t, float dt) {
    if (t < dt) {
        t /= dt;
        return t + t - t * t - 1.0f;
    } else if (t > 1.0f - dt) {
        t = (t - 1.0f) / dt;
        return t * t + t + t + 1.0f;
    }
    return 0.0f;
}

/** XorShift32 PRNG White Noise */
static inline float b_noise_white(uint32_t *seed) {
    uint32_t x = *seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    *seed = x;
    return ((float)(int32_t)x) * (1.0f / 2147483648.0f);
}

/* =========================================================================
 * Reusable DSP Filter Structures
 * ========================================================================= */

/** Chamberlin 12dB State Variable Filter (SVF) */
typedef struct {
    float s0;
    float s1;
} b_svf_t;

static inline void b_svf_init(b_svf_t *f) {
    f->s0 = 0.0f;
    f->s1 = 0.0f;
}

static inline void b_svf_process(b_svf_t *f, float in, float cutoff_hz, float res, float sr, float *out_lp, float *out_hp, float *out_bp) {
    float omega = (cutoff_hz * B_PI) / sr;
    float freq = 2.0f * b_sin_norm(omega * 0.5f);
    float q = 1.0f - b_clamp(res, 0.0f, 0.98f) * 0.95f;

    float hp = in - f->s0 - q * f->s1;
    float bp = f->s1 + freq * hp;
    float lp = f->s0 + freq * bp;

    f->s0 = lp;
    f->s1 = bp;

    if (out_lp) *out_lp = lp;
    if (out_hp) *out_hp = hp;
    if (out_bp) *out_bp = bp;
}

/** Moog 24dB 4-Pole Ladder Filter with Non-Linear Saturated Feedback */
typedef struct {
    float s[4];
} b_moog_ladder_t;

static inline void b_moog_init(b_moog_ladder_t *m) {
    m->s[0] = m->s[1] = m->s[2] = m->s[3] = 0.0f;
}

static inline float b_moog_process(b_moog_ladder_t *m, float in, float cutoff_hz, float res, float drive, float sr) {
    float f = (cutoff_hz * B_PI) / sr;
    if (f > 0.45f) f = 0.45f;
    float k = 4.0f * b_clamp(res, 0.0f, 0.98f);
    
    float input = in * drive;
    float feedback = b_tanh(m->s[3] * k);
    float u = input - feedback;

    m->s[0] += f * (b_tanh(u) - b_tanh(m->s[0]));
    m->s[1] += f * (b_tanh(m->s[0]) - b_tanh(m->s[1]));
    m->s[2] += f * (b_tanh(m->s[1]) - b_tanh(m->s[2]));
    m->s[3] += f * (b_tanh(m->s[2]) - b_tanh(m->s[3]));

    return m->s[3];
}

#endif /* BRACK_DSP_H */
