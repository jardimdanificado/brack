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
        "\"name\":\"VCF-Ladder-SVF\","
        "\"hp\":8,"
        "\"params\":["
            "{\"id\":0,\"name\":\"Cutoff\",\"min\":20,\"max\":20000,\"default\":1500},"
            "{\"id\":1,\"name\":\"Resonance\",\"min\":0,\"max\":0.98,\"default\":0.5},"
            "{\"id\":2,\"name\":\"Drive\",\"min\":1,\"max\":5,\"default\":1.0}"
        "],"
        "\"inputs\":["
            "{\"id\":0,\"name\":\"IN\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"CUTOFF CV\",\"type\":\"cv\"},"
            "{\"id\":2,\"name\":\"RES CV\",\"type\":\"cv\"}"
        "],"
        "\"outputs\":["
            "{\"id\":0,\"name\":\"MOOG 24dB\",\"type\":\"audio\"},"
            "{\"id\":1,\"name\":\"SVF LP\",\"type\":\"audio\"},"
            "{\"id\":2,\"name\":\"SVF HP\",\"type\":\"audio\"},"
            "{\"id\":3,\"name\":\"SVF BP\",\"type\":\"audio\"}"
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

B_EXPORT void b_module_process(const float **inputs, float **outputs, uint32_t n) {
    const float *in_audio  = inputs[0];
    const float *in_cv     = inputs[1];
    const float *in_res_cv = inputs[2];

    float *out_moog = outputs[0];
    float *out_lp   = outputs[1];
    float *out_hp   = outputs[2];
    float *out_bp   = outputs[3];

    float base_cutoff = g_vcf.params[0];
    float resonance   = g_vcf.params[1];
    float drive       = g_vcf.params[2];
    float sr          = g_vcf.sample_rate;

    for (uint32_t i = 0; i < n; i++) {
        float in_samp = in_audio ? in_audio[i] : 0.0f;
        float cutoff_mod = in_cv ? in_cv[i] : 0.0f;
        float res_mod    = in_res_cv ? in_res_cv[i] * 0.5f : 0.0f;

        float cutoff = base_cutoff * b_exp2(cutoff_mod);
        cutoff = b_clamp(cutoff, 10.0f, sr * 0.45f);

        float res = b_clamp(resonance + res_mod, 0.0f, 0.98f);

        // Moog 24dB Ladder
        float moog_out = b_moog_process(&g_vcf.moog, in_samp, cutoff, res, drive, sr);
        if (out_moog) out_moog[i] = moog_out;

        // SVF Filter
        float svf_lp = 0.0f, svf_hp = 0.0f, svf_bp = 0.0f;
        b_svf_process(&g_vcf.svf, in_samp * drive, cutoff, res, sr, &svf_lp, &svf_hp, &svf_bp);
        if (out_lp) out_lp[i] = svf_lp;
        if (out_hp) out_hp[i] = svf_hp;
        if (out_bp) out_bp[i] = svf_bp;
    }
}
