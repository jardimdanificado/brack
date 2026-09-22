#ifndef RACK_UI_H
#define RACK_UI_H

/**
 * =========================================================================
 * BRACK Visual Eurorack UI Header (include/rack_ui.h)
 * Pure C / Quadro-based Hardware Modular Renderer & Interaction Engine
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>
#include "quadro.h"

#define UI_HP_WIDTH      22    /* Pixels per 1HP (Eurorack width unit) */
#define UI_RACK_HEIGHT   360   /* Standard 3U Rack Height in pixels */
#define UI_MAX_UI_MODS   32
#define UI_MAX_KNOBS     128
#define UI_MAX_JACKS     128
#define UI_MAX_CABLES    128

/* Component Types */
enum {
    UI_HIT_NONE  = 0,
    UI_HIT_KNOB  = 1,
    UI_HIT_JACK  = 2,
    UI_HIT_PANEL = 3
};

enum {
    JACK_IN  = 0,
    JACK_OUT = 1
};

enum {
    SIGNAL_AUDIO = 0,
    SIGNAL_CV    = 1,
    SIGNAL_GATE  = 2
};

typedef struct {
    int32_t  id;
    int32_t  mod_idx;
    int32_t  param_id;
    int32_t  x;
    int32_t  y;
    int32_t  radius;
    float    value;       /* Normalized 0.0 .. 1.0 */
    float    min_val;
    float    max_val;
    uint32_t color;
    char     label[12];
} ui_knob_t;

typedef struct {
    int32_t  id;
    int32_t  mod_idx;
    int32_t  port_id;
    int32_t  is_output;   /* 0 = In, 1 = Out */
    int32_t  sig_type;    /* Audio, CV, Gate */
    int32_t  x;
    int32_t  y;
    char     label[12];
} ui_jack_t;

typedef struct {
    int32_t  slot_id;
    int32_t  x;
    int32_t  y;
    int32_t  hp;
    int32_t  width;
    char     name[20];
    uint32_t bg_color;
} ui_module_t;

typedef struct {
    int32_t  src_jack_id;
    int32_t  dst_jack_id;
    uint32_t color;
    uint8_t  active;
} ui_cable_t;

typedef struct {
    int32_t      width;
    int32_t      height;
    uint32_t    *framebuffer;
    
    ui_module_t  modules[UI_MAX_UI_MODS];
    int32_t      module_count;

    ui_knob_t    knobs[UI_MAX_KNOBS];
    int32_t      knob_count;

    ui_jack_t    jacks[UI_MAX_JACKS];
    int32_t      jack_count;

    ui_cable_t   cables[UI_MAX_CABLES];
    int32_t      cable_count;

    // Interactive Drag State
    int32_t      active_drag_type;  /* UI_HIT_KNOB or UI_HIT_JACK */
    int32_t      active_drag_id;
    int32_t      mouse_x;
    int32_t      mouse_y;
    int32_t      drag_start_val;

    // Cable Dragging from Jack
    int32_t      drag_cable_src_jack;
    int32_t      is_dragging_cable;
} ui_rack_state_t;

/* Visual Rack Exports */
W_EXPORT void     ui_rack_init(int32_t width, int32_t height);
W_EXPORT uint32_t* ui_rack_get_framebuffer(void);
W_EXPORT void     ui_rack_resize(int32_t width, int32_t height);

// Rack Construction
W_EXPORT int32_t  ui_rack_add_module(int32_t slot_id, const char *name, int32_t hp, uint32_t bg_color);
W_EXPORT int32_t  ui_rack_add_knob(int32_t mod_idx, int32_t param_id, int32_t rel_x, int32_t rel_y, int32_t radius, float def_val, float min_v, float max_v, const char *label);
W_EXPORT int32_t  ui_rack_add_jack(int32_t mod_idx, int32_t port_id, int32_t is_output, int32_t sig_type, int32_t rel_x, int32_t rel_y, const char *label);
W_EXPORT int32_t  ui_rack_add_cable(int32_t src_jack_id, int32_t dst_jack_id, uint32_t color);
W_EXPORT void     ui_rack_remove_cable(int32_t cable_id);
W_EXPORT void     ui_rack_clear_cables(void);

// Interaction
W_EXPORT int32_t  ui_rack_hit_test(int32_t x, int32_t y, int32_t *out_item_id);
W_EXPORT void     ui_rack_mouse_down(int32_t x, int32_t y);
W_EXPORT void     ui_rack_mouse_move(int32_t x, int32_t y, float *out_param_change);
W_EXPORT int32_t  ui_rack_mouse_up(int32_t x, int32_t y, int32_t *out_connected_src, int32_t *out_connected_dst);

// Frame Render
W_EXPORT void     ui_rack_render(const float *scope_l, uint32_t scope_len);

#endif /* RACK_UI_H */
