#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float sample_rate;
    float phase;
    int32_t tick_count;
    float params[2]; // 0 = BPM
} clock_state_t;

static clock_state_t g_clock = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"Clock-BPM\","
        "\"hp\":6,"
        "\"params\":["
            "{\"id\":0,\"name\":\"BPM\",\"min\":30,\"max\":250,\"default\":120}"
        "],"
        "\"inputs\":[],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"1/16\",\"type\":\"gate\"},"
            "{\"id\":1,\"name\":\"1/8\",\"type\":\"gate\"},"
            "{\"id\":2,\"name\":\"1/4\",\"type\":\"gate\"},"
            "{\"id\":3,\"name\":\"RESET\",\"type\":\"gate\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_clock.sample_rate = sample_rate;
    g_clock.phase = 0.0f;
    g_clock.tick_count = 0;
    g_clock.params[0] = 120.0f;
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 2) g_clock.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 2) ? g_clock.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    (void)inputs;
    float *out_16th = outputs[0];
    float *out_8th  = outputs[1];
    float *out_4th  = outputs[2];
    float *out_rst  = outputs[3];

    float bpm = b_clamp(g_clock.params[0], 20.0f, 300.0f);
    float sr  = g_clock.sample_rate;

    float freq_16th = (bpm / 60.0f) * 4.0f;
    float dt = freq_16th / sr;

    float phase = g_clock.phase;
    int32_t tick_count = g_clock.tick_count;

    for (uint32_t i = 0; i < n; i++) {
        float gate = (phase < 0.5f) ? 1.0f : 0.0f;
        if (out_16th) out_16th[i] = gate;
        if (out_8th)  out_8th[i]  = ((tick_count % 2 == 0) && gate > 0.5f) ? 1.0f : 0.0f;
        if (out_4th)  out_4th[i]  = ((tick_count % 4 == 0) && gate > 0.5f) ? 1.0f : 0.0f;
        if (out_rst)  out_rst[i]  = (tick_count == 0 && phase < 0.2f) ? 1.0f : 0.0f;

        phase += dt;
        if (phase >= 1.0f) {
            phase -= 1.0f;
            tick_count = (tick_count + 1) % 16;
        }
    }

    g_clock.phase = phase;
    g_clock.tick_count = tick_count;
}
