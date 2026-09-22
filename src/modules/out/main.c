#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float params[2]; // 0 = Master Volume
} out_state_t;

static out_state_t g_out = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"OUT\","
        "\"category\":\"OUT\","
        "\"params\":["
            "{\"id\":0,\"name\":\"Master Vol\",\"min\":0,\"max\":1.5,\"default\":0.85}"
        "],"
        "\"outputs\":["
            "{\"type\":\"AUDIO\",\"name\":\"OUT L\"},"
            "{\"type\":\"AUDIO\",\"name\":\"OUT R\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    (void)sample_rate;
    g_out.params[0] = 0.85f;
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 2) g_out.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 2) ? g_out.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(
    void *instance,
    const brack_in_link_t *in_links,
    uint32_t in_count,
    brack_out_link_t *out_links,
    uint32_t *out_count,
    uint32_t num_samples
) {
    float vol_mod = 0.0f;
    for (uint32_t i = 0; i < in_count; i++) {
        if (in_links[i].type == BRACK_LINK_VAL) {
            vol_mod += in_links[i].val;
        }
    }

    float vol = b_clamp(g_out.params[0] + vol_mod, 0.0f, 2.0f);
    float *out_l = out_links[0].audio;
    float *out_r = out_links[1].audio;

    out_links[0].type = BRACK_LINK_AUDIO;
    out_links[1].type = BRACK_LINK_AUDIO;
    if (out_count) *out_count = 2;

    for (uint32_t s = 0; s < num_samples; s++) {
        float in_sum = 0.0f;
        for (uint32_t i = 0; i < in_count; i++) {
            if (in_links[i].type == BRACK_LINK_AUDIO && in_links[i].audio) {
                in_sum += in_links[i].audio[s];
            }
        }

        float out = b_tanh(in_sum * vol);
        if (out_l) out_l[s] = out;
        if (out_r) out_r[s] = out;
    }
}

