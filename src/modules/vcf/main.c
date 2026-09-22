#include "brack_core.h"
#include "brack_dsp.h"

typedef struct {
    float sample_rate;
    b_moog_ladder_t moog;
    b_svf_t svf;
    float params[4];
} vcf_state_t;

static vcf_state_t g_vcf = {0};

B_EXPORT const char* b_module_descriptor(void) {
    return "{"
        "\"name\":\"VCF\","
        "\"category\":\"FILTER\","
        "\"params\":["
            "{\"id\":0,\"name\":\"Cutoff\",\"min\":20,\"max\":20000,\"default\":1500},"
            "{\"id\":1,\"name\":\"Resonance\",\"min\":0,\"max\":0.98,\"default\":0.5},"
            "{\"id\":2,\"name\":\"Drive\",\"min\":1,\"max\":5,\"default\":1.0}"
        "],"
        "\"outputs\":["
            "{\"type\":\"AUDIO\",\"name\":\"OUT\"}"
        "]"
    "}";
}

B_EXPORT void b_module_init(float sample_rate) {
    g_vcf.sample_rate = sample_rate;
    b_moog_init(&g_vcf.moog);
    b_svf_init(&g_vcf.svf);
    g_vcf.params[0] = 1500.0f; // Cutoff
    g_vcf.params[1] = 0.5f;    // Res
    g_vcf.params[2] = 1.0f;    // Drive
}

B_EXPORT void b_module_set_param(uint32_t param_id, float value) {
    if (param_id < 4) g_vcf.params[param_id] = value;
}

B_EXPORT float b_module_get_param(uint32_t param_id) {
    return (param_id < 4) ? g_vcf.params[param_id] : 0.0f;
}

B_EXPORT void b_module_process(
    void *instance,
    const brack_in_link_t *in_links,
    uint32_t in_count,
    brack_out_link_t *out_links,
    uint32_t *out_count,
    uint32_t num_samples
) {
    float cv_mod = 0.0f;
    
    // Check CV modulation from VAL inputs
    for (uint32_t i = 0; i < in_count; i++) {
        if (in_links[i].type == BRACK_LINK_VAL) {
            cv_mod += in_links[i].val;
        }
    }

    float base_cutoff = g_vcf.params[0];
    float resonance   = g_vcf.params[1];
    float drive       = g_vcf.params[2];
    float sr          = g_vcf.sample_rate;

    float cutoff = base_cutoff * b_exp2(cv_mod);
    cutoff = b_clamp(cutoff, 10.0f, sr * 0.45f);
    float res = b_clamp(resonance, 0.0f, 0.98f);

    float *out_buf = out_links[0].audio;
    out_links[0].type = BRACK_LINK_AUDIO;
    if (out_count) *out_count = 1;

    for (uint32_t s = 0; s < num_samples; s++) {
        // Sum all incoming audio streams
        float in_samp = 0.0f;
        for (uint32_t i = 0; i < in_count; i++) {
            if (in_links[i].type == BRACK_LINK_AUDIO && in_links[i].audio) {
                in_samp += in_links[i].audio[s];
            }
        }

        float moog_out = b_moog_process(&g_vcf.moog, in_samp, cutoff, res, drive, sr);
        if (out_buf) out_buf[s] = moog_out;
    }
}

