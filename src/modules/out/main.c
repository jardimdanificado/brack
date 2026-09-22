#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float params[2]; // 0 = Master Volume
} out_state_t;

static out_state_t g_out = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"Master-Out\","
        "\"hp\":6,"
        "\"params\":["
            "{\"id\":0,\"name\":\"Master Volume\",\"min\":0,\"max\":1.5,\"default\":0.85}"
        "],"
        "\"inputs\":["
            "{\"id\":0,\"name\":\"IN L\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"IN R\",\"type\":\"audio\"}"
        "],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"MON L\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"MON R\",\"type\":\"audio\"}"
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

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    const float *in_l = inputs[0];
    const float *in_r = inputs[1];

    float *out_l = outputs[0];
    float *out_r = outputs[1];

    float vol = g_out.params[0];

    for (uint32_t i = 0; i < n; i++) {
        float l = (in_l ? in_l[i] : 0.0f) * vol;
        float r = (in_r ? in_r[i] : 0.0f) * vol;

        // Tube soft-clipping protection
        l = b_tanh(l);
        r = b_tanh(r);

        if (out_l) out_l[i] = l;
        if (out_r) out_r[i] = r;
    }
}
