#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    int32_t step;
    float last_clock;
    float last_reset;
    float params[20]; // 0..7 = Pitch CVs, 8..15 = Gates, 16 = Length
} seq_state_t;

static seq_state_t g_seq = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"SEQ-8\","
        "\"hp\":12,"
        "\"params\":["
            "{\"id\":0,\"name\":\"Step 1\",\"min\":-2,\"max\":2,\"default\":0},"
            "{\"id\":1,\"name\":\"Step 2\",\"min\":-2,\"max\":2,\"default\":0},"
            "{\"id\":2,\"name\":\"Step 3\",\"min\":-2,\"max\":2,\"default\":0},"
            "{\"id\":3,\"name\":\"Step 4\",\"min\":-2,\"max\":2,\"default\":0},"
            "{\"id\":4,\"name\":\"Step 5\",\"min\":-2,\"max\":2,\"default\":0},"
            "{\"id\":5,\"name\":\"Step 6\",\"min\":-2,\"max\":2,\"default\":0},"
            "{\"id\":6,\"name\":\"Step 7\",\"min\":-2,\"max\":2,\"default\":0},"
            "{\"id\":7,\"name\":\"Step 8\",\"min\":-2,\"max\":2,\"default\":0}"
        "],"
        "\"inputs\":["
            "{\"id\":0,\"name\":\"CLOCK\",\"type\":\"gate\"},"
            "{\"id\":1,\"name\":\"RESET\",\"type\":\"gate\"}"
        "],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"CV OUT\",\"type\":\"cv\"},"
            "{\"id\":1,\"name\":\"GATE OUT\",\"type\":\"gate\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    (void)sample_rate;
    g_seq.step = 0;
    g_seq.last_clock = 0.0f;
    g_seq.last_reset = 0.0f;
    for (int i = 0; i < 8; i++) {
        g_seq.params[i] = 0.0f;
        g_seq.params[8 + i] = 1.0f; // Gate active
    }
    g_seq.params[16] = 8.0f; // 8 steps
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 20) g_seq.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 20) ? g_seq.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    const float *in_clk = inputs[0];
    const float *in_rst = inputs[1];

    float *out_cv   = outputs[0];
    float *out_gate = outputs[1];

    int32_t step = g_seq.step;
    float last_clk = g_seq.last_clock;
    float last_rst = g_seq.last_reset;

    uint32_t length = (uint32_t)g_seq.params[16];
    if (length == 0 || length > 16) length = 8;

    for (uint32_t i = 0; i < n; i++) {
        if (in_rst && in_rst[i] > 0.5f && last_rst <= 0.5f) {
            step = 0;
        }
        if (in_rst) last_rst = in_rst[i];

        if (in_clk && in_clk[i] > 0.5f && last_clk <= 0.5f) {
            step = (step + 1) % length;
        }
        if (in_clk) last_clk = in_clk[i];

        float note_cv = g_seq.params[step];
        float gate_en = g_seq.params[8 + (step % 8)];

        if (out_cv) out_cv[i] = note_cv;
        if (out_gate) out_gate[i] = (in_clk && in_clk[i] > 0.5f && gate_en > 0.5f) ? 1.0f : 0.0f;
    }

    g_seq.step = step;
    g_seq.last_clock = last_clk;
    g_seq.last_reset = last_rst;
}
