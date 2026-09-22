#ifndef BRACK_CORE_H
#define BRACK_CORE_H

/**
 * =========================================================================
 * BRACK Microkernel Audio Host ABI (include/brack_core.h)
 * Pure Freestanding Eurorack Rack Bus, Patch Bay, Cable Matrix & Host
 * Zero hardcoded DSP generators: 100% extensible via WASM modules.
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>

#define B_EXPORT __attribute__((visibility("default")))

#define BRACK_BLOCK_SIZE      128   /* Standard WebAudio Block Size */
#define BRACK_MAX_SLOTS       64    /* Max module slots in rack */
#define BRACK_MAX_PORTS       16    /* Max I/O ports per slot */
#define BRACK_MAX_CHANNELS    16    /* Max polyphonic channels per cable */
#define BRACK_MAX_CABLES      256   /* Max patch cables in rack */
#define BRACK_MAX_MIDI_EVENTS 64    /* Max MIDI events per block */
#define BRACK_SCOPE_BUFFER    512   /* Samples retained for oscilloscope */

/* =========================================================================
 * MIDI & Transport Types
 * ========================================================================= */

typedef struct {
    uint8_t  status;    /* e.g. 0x90 = Note On, 0x80 = Note Off, 0xB0 = CC */
    uint8_t  data1;     /* Note number / CC number */
    uint8_t  data2;     /* Velocity / CC value */
    uint8_t  channel;   /* MIDI Channel 0..15 */
    uint32_t frame_offset; /* Sample offset within current 128-sample block */
} brack_midi_event_t;

typedef struct {
    float    sample_rate;
    float    bpm;
    double   sample_time;       /* Running time in seconds */
    uint64_t total_samples;
    uint8_t  playing;           /* 1 = Running, 0 = Stopped */
    uint8_t  clock_pulse_16th;  /* 1 on 16th note edge */
    uint8_t  clock_pulse_24ppqn;/* 24 Pulses Per Quarter Note standard */
} brack_transport_t;

/* =========================================================================
 * Universal Module WASM ABI Definition
 * Every independent module (.wasm) implements this standard interface.
 * ========================================================================= */

typedef struct {
    // Descriptor returns JSON: {"name":"VCO","hp":10,"inputs":[...],"outputs":[...],"params":[...]}
    const char* (*get_descriptor)(void);
    
    // Lifecycle
    void* (*init)(float sample_rate);
    void  (*destroy)(void *instance);
    void  (*reset)(void *instance);
    
    // Parameters & Control
    void  (*set_param)(void *instance, uint32_t param_id, float value);
    float (*get_param)(void *instance, uint32_t param_id);
    
    // Real-Time DSP Block Process
    void  (*process)(
        void *instance,
        const float *const *inputs,   /* [port_idx][sample_idx] */
        float *const *outputs,        /* [port_idx][sample_idx] */
        const brack_midi_event_t *midi_events,
        uint32_t midi_count,
        uint32_t num_samples
    );
    
    // Preset State Serialization (Optional)
    uint32_t (*save_state)(void *instance, uint8_t *out_buf, uint32_t max_len);
    void     (*load_state)(void *instance, const uint8_t *in_buf, uint32_t len);

    // Custom OLED / Screen Display Buffer (Optional)
    uint32_t* (*render_screen)(void *instance, int *out_w, int *out_h);
} brack_module_abi_t;

/* =========================================================================
 * Patch Cable & Slot Matrix
 * ========================================================================= */

typedef struct {
    uint16_t src_slot;
    uint8_t  src_port;
    uint16_t dst_slot;
    uint8_t  dst_port;
    float    gain;          /* Attenuator / Cable gain */
    uint8_t  channels;      /* Polyphony channels (1 = mono, up to 16) */
    uint8_t  active;
    uint8_t  is_feedback;   /* 1 = Feedback loop connection (reads previous block) */
} brack_cable_t;

typedef struct {
    uint8_t  active;
    uint8_t  in_port_count;
    uint8_t  out_port_count;
    
    // Current block audio & CV buffers: [port_idx][sample_idx]
    float    in_buffers[BRACK_MAX_PORTS][BRACK_BLOCK_SIZE];
    float    out_buffers[BRACK_MAX_PORTS][BRACK_BLOCK_SIZE];
    
    // Double-buffered previous block outputs for zero-latency cyclic feedback
    float    prev_out_buffers[BRACK_MAX_PORTS][BRACK_BLOCK_SIZE];
} brack_slot_t;

typedef struct {
    brack_transport_t  transport;
    
    brack_slot_t       slots[BRACK_MAX_SLOTS];
    uint32_t           slot_count;
    
    brack_cable_t      cables[BRACK_MAX_CABLES];
    uint32_t           cable_count;
    
    // Topological execution order
    uint16_t           exec_order[BRACK_MAX_SLOTS];
    uint32_t           exec_count;
    
    // Master MIDI In Queue for current block
    brack_midi_event_t midi_queue[BRACK_MAX_MIDI_EVENTS];
    uint32_t           midi_count;
    
    // Master Stereo Output & Oscilloscope Visualizer
    float              master_out_l[BRACK_BLOCK_SIZE];
    float              master_out_r[BRACK_BLOCK_SIZE];
    float              scope_buffer_l[BRACK_SCOPE_BUFFER];
    float              scope_buffer_r[BRACK_SCOPE_BUFFER];
    uint32_t           scope_head;
} brack_core_engine_t;

/* =========================================================================
 * Core Host Exported Functions (WASM ABI)
 * ========================================================================= */

// Engine Lifecycle
B_EXPORT void     brack_core_init(float sample_rate);
B_EXPORT void     brack_core_set_sample_rate(float sample_rate);
B_EXPORT void     brack_core_set_bpm(float bpm);
B_EXPORT float    brack_core_get_bpm(void);
B_EXPORT void     brack_core_set_playing(uint32_t playing);

// Slot Management
B_EXPORT int32_t  brack_slot_create(uint32_t in_ports, uint32_t out_ports);
B_EXPORT void     brack_slot_destroy(int32_t slot_id);
B_EXPORT float*   brack_slot_get_in_ptr(int32_t slot_id, uint32_t port_id);
B_EXPORT float*   brack_slot_get_out_ptr(int32_t slot_id, uint32_t port_id);

// Patch Cables & Routing
B_EXPORT int32_t  brack_cable_connect(uint16_t src_slot, uint8_t src_port, uint16_t dst_slot, uint8_t dst_port, float gain);
B_EXPORT void     brack_cable_disconnect(int32_t cable_id);
B_EXPORT void     brack_cable_clear(void);

// Master Audio Block Execution
B_EXPORT void     brack_core_prepare_block(uint32_t num_samples);
B_EXPORT void     brack_core_finish_block(uint32_t num_samples);
B_EXPORT void     brack_core_get_master_out(float *out_l, float *out_r, uint32_t num_samples);

// Master Scope & Monitoring
B_EXPORT const float* brack_core_get_scope_l(void);
B_EXPORT const float* brack_core_get_scope_r(void);
B_EXPORT uint32_t     brack_core_get_scope_size(void);

// MIDI Input Push
B_EXPORT void     brack_core_push_midi(uint8_t status, uint8_t data1, uint8_t data2, uint8_t channel, uint32_t offset);

#endif /* BRACK_CORE_H */
