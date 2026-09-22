#ifndef QUADRO_CHALK_H
#define QUADRO_CHALK_H

/**
 * =========================================================================
 * BRACK Quadro Chalk Engine Header (include/quadro_chalk.h)
 * 100% C/WASM Blackboard: Clean Crisp Module Cards + Quadro Chalk Wires
 * Supports 3 Link Types: AUDIO (0), MIDI (1), VAL (2)
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>
#include "quadro.h"
#include "chalk_font.h"

#define MAX_CHALK_NODES    48
#define MAX_CHALK_LINKS    96
#define MAX_INPUT_SOURCES  12
#define MAX_CHALK_SLIDERS  8
#define MAX_OUTPUT_PINS    4

enum {
    CHALK_LINK_AUDIO = 0,
    CHALK_LINK_MIDI  = 1,
    CHALK_LINK_VAL   = 2
};

typedef struct {
    int32_t src_node;
    int32_t src_out_idx;
    uint8_t link_type; /* 0=AUDIO, 1=MIDI, 2=VAL */
    float   gain;
    char    src_name[16];
} chalk_received_input_t;

typedef struct {
    int32_t param_id;
    char    name[12];
    char    val_str[12];
    float   value;        /* 0.0 .. 1.0 */
    float   min_val;
    float   max_val;
} chalk_slider_entry_t;

#define MAX_CODE_LINES     24
#define MAX_LINE_CHARS     44

typedef struct {
    int32_t  id;
    int32_t  slot_id;
    char     name[20];
    char     category[12];
    uint32_t accent_color;
    
    // World coordinates on blackboard
    float    x;
    float    y;
    float    w;
    float    h;

    // Code Lines Buffer for Text Box on Blackboard
    char     code_lines[MAX_CODE_LINES][MAX_LINE_CHARS];
    int32_t  code_line_count;

    // Dynamic list of incoming module sources
    chalk_received_input_t inputs[MAX_INPUT_SOURCES];
    int32_t                input_count;

    // Out link types offered by this module
    uint8_t                out_types[MAX_OUTPUT_PINS];
    char                   out_names[MAX_OUTPUT_PINS][10];
    int32_t                out_count;

    // Sliders
    chalk_slider_entry_t   sliders[MAX_CHALK_SLIDERS];
    int32_t                slider_count;

    // Live Oscilloscope buffer
    float    scope_data[48];
    uint8_t  active;
    uint8_t  is_selected;
} chalk_module_node_t;

typedef struct {
    int32_t  src_node;
    int32_t  src_out_idx;
    int32_t  dst_node;
    uint8_t  link_type; /* 0=AUDIO, 1=MIDI, 2=VAL */
    uint32_t color;
    uint8_t  active;
} chalk_module_link_t;

typedef struct {
    int32_t              view_w;
    int32_t              view_h;
    
    // Camera Transform (Zoom & Pan)
    float                cam_x;
    float                cam_y;
    float                zoom;

    chalk_module_node_t  nodes[MAX_CHALK_NODES];
    int32_t              node_count;

    chalk_module_link_t  links[MAX_CHALK_LINKS];
    int32_t              link_count;

    // Interaction State
    int32_t              drag_mode; // 0=None, 1=Move Node, 2=Chalk Wire Drag, 3=Slider Drag, 4=Pan
    int32_t              active_node_id;
    int32_t              active_slider_id;
    int32_t              wire_src_node;
    int32_t              wire_src_out_idx;
    uint8_t              wire_type;
    float                mouse_screen_x;
    float                mouse_screen_y;
    float                drag_off_x;
    float                drag_off_y;

    uint32_t             chalk_seed;
    uint32_t             anim_frame;
} quadro_board_t;

/* C / WASM Exports */
W_EXPORT void     quadro_chalk_init(int32_t width, int32_t height);
W_EXPORT uint32_t* quadro_chalk_get_framebuffer(void);
W_EXPORT void     quadro_chalk_resize(int32_t width, int32_t height);
W_EXPORT void     quadro_chalk_set_camera(float cam_x, float cam_y, float zoom);
W_EXPORT int32_t  quadro_chalk_add_node(int32_t slot_id, const char *name, const char *category, uint32_t color, float x, float y, float w, float h);
W_EXPORT void     quadro_chalk_add_node_output(int32_t node_id, uint8_t type, const char *out_name);
W_EXPORT int32_t  quadro_chalk_add_slider(int32_t node_id, int32_t param_id, const char *name, const char *unit, float def_v, float min_v, float max_v);
W_EXPORT void     quadro_chalk_update_slider_str(int32_t node_id, int32_t slider_idx, const char *str);
W_EXPORT int32_t  quadro_chalk_connect(int32_t src_node, int32_t src_out_idx, int32_t dst_node, uint8_t link_type, float gain);
W_EXPORT void     quadro_chalk_disconnect(int32_t src_node, int32_t dst_node);
W_EXPORT void     quadro_chalk_clear(void);
W_EXPORT void     quadro_chalk_feed_scope(int32_t node_id, const float *samples, uint32_t count);
W_EXPORT void     quadro_chalk_set_node_code(int32_t node_id, const char *code_text);
W_EXPORT void     quadro_chalk_set_selected_node(int32_t node_id);
W_EXPORT int32_t  quadro_chalk_get_selected_node(void);
W_EXPORT char*    quadro_chalk_get_string_pool(void);

W_EXPORT void     quadro_chalk_mouse_down(float screen_x, float screen_y, int32_t button);
W_EXPORT int32_t  quadro_chalk_mouse_move(float screen_x, float screen_y, int32_t *out_slot, int32_t *out_param, float *out_val);
W_EXPORT int32_t  quadro_chalk_mouse_up(float screen_x, float screen_y, int32_t *out_src_slot, int32_t *out_src_out_idx, int32_t *out_dst_slot, int32_t *out_link_type);

W_EXPORT void     quadro_chalk_render(void);

#endif /* QUADRO_CHALK_H */
