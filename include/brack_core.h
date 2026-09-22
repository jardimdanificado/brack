#ifndef BRACK_CORE_H
#define BRACK_CORE_H

/**
 * =========================================================================
 * BRACK Microkernel Audio Host ABI (include/brack_core.h)
 * Pure Freestanding Rack Bus, Patch Bay & Dynamic Multi-Link Matrix
 * 3 Core Link Types: AUDIO, MIDI, VAL
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>

#define B_EXPORT __attribute__((visibility("default")))

#define BRACK_BLOCK_SIZE       128   /* Standard WebAudio Block Size */
#define BRACK_MAX_SLOTS        64    /* Max module slots in rack */
#define BRACK_MAX_OUT_LINKS    16    /* Max output links per slot */
#define BRACK_MAX_IN_LINKS     32    /* Max dynamic incoming links per slot */
#define BRACK_MAX_LINKS        256   /* Max patch links in rack */
#define BRACK_MAX_MIDI_EVENTS  64    /* Max MIDI events per block */
#define BRACK_SCOPE_BUFFER     512   /* Samples retained for oscilloscope */

/* =========================================================================
 * 3 Core Link Types
 * ========================================================================= */

typedef enum {
    BRACK_LINK_AUDIO = 0, /* Audio rate float buffer (BRACK_BLOCK_SIZE samples) */
    BRACK_LINK_MIDI  = 1, /* MIDI event stream (array of brack_midi_event_t) */
    BRACK_LINK_VAL   = 2  /* Continuous control value / CV modulation (float) */
} brack_link_type_t;

/* =========================================================================
 * MIDI & Transport Types
 * ========================================================================= */

typedef struct {
    uint8_t  status;       /* e.g. 0x90 = Note On, 0x80 = Note Off, 0xB0 = CC */
    uint8_t  data1;        /* Note number / CC number */
    uint8_t  data2;        /* Velocity / CC value */
    uint8_t  channel;      /* MIDI Channel 0..15 */
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
 * Dynamic In/Out Link Payloads
 * ========================================================================= */

typedef struct {
    uint8_t                  type;        /* BRACK_LINK_AUDIO, MIDI, VAL */
    uint16_t                 src_slot;    /* Source module slot ID */
    uint16_t                 src_out_idx; /* Output index of source module */
    float                    gain;        /* Attenuation / scale */
    
    // Direct pointer to data for current block
    const float              *audio;      /* float[128] if type == AUDIO, else NULL */
    const brack_midi_event_t *midi_events;/* pointer if type == MIDI, else NULL */
    uint32_t                 midi_count;  /* count if type == MIDI */
    float                    val;         /* scalar value if type == VAL */
} brack_in_link_t;

typedef struct {
    uint8_t            type;        /* BRACK_LINK_AUDIO, MIDI, VAL */
    float              *audio;      /* float[128] buffer allocated by slot */
    brack_midi_event_t *midi_events;/* pointer to midi event array */
    uint32_t           midi_count;  /* count written by module */
    float              val;         /* scalar written by module */
} brack_out_link_t;

/* =========================================================================
 * Universal Dynamic Module WASM ABI
 * Every independent module (.wasm) implements this standard interface.
 * ========================================================================= */

typedef struct {
    // Descriptor returns JSON: {"name":"VCO","category":"GEN","outputs":[{"type":"AUDIO","name":"Out"}]}
    const char* (*get_descriptor)(void);
    
    // Lifecycle
    void* (*init)(float sample_rate);
    void  (*destroy)(void *instance);
    void  (*reset)(void *instance);
    
    // Parameters & Control
    void  (*set_param)(void *instance, uint32_t param_id, float value);
    float (*get_param)(void *instance, uint32_t param_id);
    
    // Real-Time Dynamic DSP Block Process
    void  (*process)(
        void *instance,
        const brack_in_link_t *in_links,
        uint32_t in_count,
        brack_out_link_t *out_links,
        uint32_t *out_count,
        uint32_t num_samples
    );
    
    // Preset State Serialization
    uint32_t (*save_state)(void *instance, uint8_t *out_buf, uint32_t max_len);
    void     (*load_state)(void *instance, const uint8_t *in_buf, uint32_t len);

    // Custom Module Layout & Quadro Sizing
    void (*get_dimensions)(void *instance, float *out_w, float *out_h);
} brack_module_abi_t;

/* =========================================================================
 * Patch Bay & Slot Matrix
 * ========================================================================= */

typedef struct {
    uint16_t src_slot;
    uint8_t  src_out_idx;
    uint16_t dst_slot;
    uint8_t  type;          /* BRACK_LINK_AUDIO, MIDI, VAL */
    float    gain;          /* Cable attenuator */
    uint8_t  active;
    uint8_t  is_feedback;   /* 1 = Feedback loop (reads previous block) */
} brack_link_t;

typedef struct {
    uint8_t            active;
    
    // Output buffers for current block
    uint32_t           out_count;
    uint8_t            out_types[BRACK_MAX_OUT_LINKS];
    float              out_audio[BRACK_MAX_OUT_LINKS][BRACK_BLOCK_SIZE];
    brack_midi_event_t out_midi[BRACK_MAX_OUT_LINKS][BRACK_MAX_MIDI_EVENTS];
    uint32_t           out_midi_count[BRACK_MAX_OUT_LINKS];
    float              out_val[BRACK_MAX_OUT_LINKS];
    
    // Previous block output buffers for feedback loops
    float              prev_out_audio[BRACK_MAX_OUT_LINKS][BRACK_BLOCK_SIZE];
    float              prev_out_val[BRACK_MAX_OUT_LINKS];

    // Incoming links prepared for module's process()
    brack_in_link_t    in_links[BRACK_MAX_IN_LINKS];
    uint32_t           in_link_count;

    // Out links prepared for module's process()
    brack_out_link_t   out_links[BRACK_MAX_OUT_LINKS];
} brack_slot_t;

typedef struct {
    brack_transport_t  transport;
    
    brack_slot_t       slots[BRACK_MAX_SLOTS];
    uint32_t           slot_count;
    
    brack_link_t       links[BRACK_MAX_LINKS];
    uint32_t           link_count;
    
    // Topological execution order
    uint16_t           exec_order[BRACK_MAX_SLOTS];
    uint32_t           exec_count;
    
    // Master MIDI In Queue
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
B_EXPORT int32_t  brack_slot_create(void);
B_EXPORT void     brack_slot_destroy(int32_t slot_id);
B_EXPORT void*    brack_slot_get_in_links_ptr(int32_t slot_id);
B_EXPORT uint32_t brack_slot_get_in_links_count(int32_t slot_id);
B_EXPORT void*    brack_slot_get_out_links_ptr(int32_t slot_id);
B_EXPORT void*    brack_slot_get_out_val_ptr(int32_t slot_id);
B_EXPORT void     brack_slot_set_out_val(int32_t slot_id, uint32_t out_idx, float val);
B_EXPORT void     brack_slot_set_out_midi_count(int32_t slot_id, uint32_t out_idx, uint32_t count);

// Patch Links Matrix
B_EXPORT int32_t  brack_link_connect(uint16_t src_slot, uint8_t src_out_idx, uint16_t dst_slot, uint8_t link_type, float gain);
B_EXPORT void     brack_link_disconnect(int32_t link_id);
B_EXPORT void     brack_link_disconnect_pair(uint16_t src_slot, uint16_t dst_slot);
B_EXPORT void     brack_link_clear(void);

// Master Audio Block Execution
B_EXPORT void     brack_core_prepare_block(uint32_t num_samples);
B_EXPORT void     brack_core_finish_block(uint32_t num_samples);
B_EXPORT void     brack_core_route_slot_outputs(int32_t slot_id);
B_EXPORT void     brack_core_get_master_out(float *out_l, float *out_r, uint32_t num_samples);

// Master Scope & Monitoring
B_EXPORT const float* brack_core_get_scope_l(void);
B_EXPORT const float* brack_core_get_scope_r(void);
B_EXPORT uint32_t     brack_core_get_scope_size(void);

// MIDI Input Push
B_EXPORT void     brack_core_push_midi(uint8_t status, uint8_t data1, uint8_t data2, uint8_t channel, uint32_t offset);

#endif /* BRACK_CORE_H */
