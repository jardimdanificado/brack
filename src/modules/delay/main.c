#include "brack_core.h"
#include "brack_dsp.h"

#define MAX_DELAY_BUF 96000 // 2s @ 48kHz

typedef struct {
    float sample_rate;
    float buffer[MAX_DELAY_BUF];
    uint32_t head;
    float lpf_state;
    float params[4];
} delay_state_t;

static delay_state_t g_delay = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"Tape-Delay\","
        "\"hp\":10,"
        "\"params\":["
            "{\"id\":0,\"name\":\"Time\",\"min\":0.01,\"max\":1.8,\"default\":0.30},"
            "{\"id\":1,\"name\":\"Feedback\",\"min\":0,\"max\":0.95,\"default\":0.40},"
            "{\"id\":2,\"name\":\"Damp\",\"min\":0,\"max\":0.9,\"default\":0.40},"
            "{\"id\":3,\"name\":\"Mix\",\"min\":0,\"max\":1.0,\"default\":0.35}"
        "],"
        "\"inputs\":["
            "{\"id\":0,\"name\":\"IN\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"TIME CV\",\"type\":\"cv\"}"
        "],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"OUT L\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"OUT R\",\"type\":\"audio\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_delay.sample_rate = sample_rate;
    g_delay.head = 0;
    g_delay.lpf_state = 0.0f;
    for (int i = 0; i < MAX_DELAY_BUF; i++) g_delay.buffer[i] = 0.0f;
    g_delay.params[0] = 0.30f;
    g_delay.params[1] = 0.40f;
    g_delay.params[2] = 0.40f;
    g_delay.params[3] = 0.35f;
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 4) g_delay.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 4) ? g_delay.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    const float *in_audio = inputs[0];
    const float *in_time  = inputs[1];

    float *out_l = outputs[0];
    float *out_r = outputs[1];

    float delay_time = b_clamp(g_delay.params[0], 0.01f, 1.8f);
    float feedback   = b_clamp(g_delay.params[1], 0.0f, 0.95f);
    float damp       = b_clamp(g_delay.params[2], 0.0f, 0.9f);
    float mix        = b_clamp(g_delay.params[3], 0.0f, 1.0f);
    float sr         = g_delay.sample_rate;

    uint32_t head   = g_delay.head;
    float lpf_state = g_delay.lpf_state;

    for (uint32_t i = 0; i < n; i++) {
        float in_samp = in_audio ? in_audio[i] : 0.0f;
        float eff_time = delay_time + (in_time ? in_time[i] * 0.2f : 0.0f);
        eff_time = b_clamp(eff_time, 0.005f, 1.9f);

        float delay_samples = eff_time * sr;
        float r_pos = (float)head - delay_samples;
        if (r_pos < 0.0f) r_pos += (float)MAX_DELAY_BUF;

        int32_t r_idx = (int32_t)r_pos;
        float frac = r_pos - (float)r_idx;

        int32_t idx1 = r_idx % MAX_DELAY_BUF;
        int32_t idx2 = (idx1 + 1) % MAX_DELAY_BUF;
        float delayed = b_lerp(g_delay.buffer[idx1], g_delay.buffer[idx2], frac);

        lpf_state = delayed * (1.0f - damp) + lpf_state * damp;
        float to_write = in_samp + b_tanh(lpf_state * feedback);
        g_delay.buffer[head] = to_write;

        head = (head + 1) % MAX_DELAY_BUF;

        float wet = delayed;
        float dry = in_samp;
        float out = b_lerp(dry, wet, mix);

        if (out_l) out_l[i] = out;
        if (out_r) out_r[i] = out;
    }

    g_delay.head = head;
    g_delay.lpf_state = lpf_state;
}
