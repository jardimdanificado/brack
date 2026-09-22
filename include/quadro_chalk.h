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
#define MAX_CHALK_SOCKETS  6
#define MAX_CHALK_SLIDERS  8
#define MAX_OUTPUT_PILLS   4

enum {
    CHALK_LINK_AUDIO = 0,
    CHALK_LINK_MIDI  = 1,
    CHALK_LINK_VAL   = 2
};

typedef struct {
    char    name[14];
    uint8_t type; /* 0=AUDIO, 1=MIDI, 2=VAL */
    int32_t connected_src_node; /* -1 if disconnected */
    int32_t connected_src_out;  /* index of src out pill */
    char    connected_label[18];
} chalk_socket_t;

typedef struct {
    char    name[14];
    uint8_t type; /* 0=AUDIO, 1=MIDI, 2=VAL */
    uint32_t color;
} chalk_output_pill_t;

typedef struct {
    int32_t param_id;
    char    name[12];
    char    val_str[12];
    float   value;        /* 0.0 .. 1.0 */
    float   min_val;
    float   max_val;
} chalk_slider_entry_t;

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

    // Stack Interlocking Chain
    int32_t  stack_parent; /* -1 if top of stack */
    int32_t  stack_child;  /* -1 if bottom of stack */

    // Scratch Input Sockets (Notches)
    chalk_socket_t       sockets[MAX_CHALK_SOCKETS];
    int32_t              socket_count;

    // Scratch Output Reporter Pills
    chalk_output_pill_t  pills[MAX_OUTPUT_PILLS];
    int32_t              pill_count;

    // Sliders
    chalk_slider_entry_t sliders[MAX_CHALK_SLIDERS];
    int32_t              slider_count;

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
    int32_t              drag_mode; // 0=None, 1=Move Block/Stack, 2=Drag Teleport Pill, 3=Slider Drag, 4=Pan
    int32_t              active_node_id;
    int32_t              active_slider_id;
    int32_t              active_socket_id;
    int32_t              wire_src_node;
    int32_t              wire_src_out_idx;
    uint8_t              wire_type;
    int32_t              snap_target_parent;
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
W_EXPORT float    quadro_chalk_get_cam_x(void);
W_EXPORT float    quadro_chalk_get_cam_y(void);
W_EXPORT float    quadro_chalk_get_zoom(void);
W_EXPORT int32_t  quadro_chalk_add_node(int32_t slot_id, const char *name, const char *category, uint32_t color, float x, float y, float w, float h);
W_EXPORT void     quadro_chalk_add_socket(int32_t node_id, const char *name, uint8_t type);
W_EXPORT void     quadro_chalk_add_pill(int32_t node_id, const char *name, uint8_t type, uint32_t color);
W_EXPORT int32_t  quadro_chalk_add_slider(int32_t node_id, int32_t param_id, const char *name, const char *unit, float def_v, float min_v, float max_v);
W_EXPORT void     quadro_chalk_update_slider_str(int32_t node_id, int32_t slider_idx, const char *str);
W_EXPORT int32_t  quadro_chalk_connect_socket(int32_t src_node, int32_t src_out_idx, int32_t dst_node, int32_t dst_socket_idx);
W_EXPORT void     quadro_chalk_disconnect_socket(int32_t dst_node, int32_t socket_idx);
W_EXPORT void     quadro_chalk_stack_attach(int32_t parent_id, int32_t child_id);
W_EXPORT void     quadro_chalk_stack_detach(int32_t child_id);
W_EXPORT int32_t  quadro_chalk_get_active_links(int32_t *out_src, int32_t *out_src_out, int32_t *out_dst, int32_t *out_dst_socket, int32_t *out_type);
W_EXPORT void     quadro_chalk_clear(void);
W_EXPORT void     quadro_chalk_feed_scope(int32_t node_id, const float *samples, uint32_t count);
W_EXPORT void     quadro_chalk_set_node_code(int32_t node_id, const char *code_text);
W_EXPORT void     quadro_chalk_set_selected_node(int32_t node_id);
W_EXPORT int32_t  quadro_chalk_get_selected_node(void);
W_EXPORT char*    quadro_chalk_get_string_pool(void);

W_EXPORT void     quadro_chalk_mouse_down(float screen_x, float screen_y, int32_t button);
W_EXPORT int32_t  quadro_chalk_mouse_move(float screen_x, float screen_y, int32_t *out_slot, int32_t *out_param, float *out_val);
W_EXPORT void     quadro_chalk_render(void);

/* Public GFX Drawing API for JS Modules */
W_EXPORT void     quadro_chalk_draw_rect(int32_t x, int32_t y, int32_t w, int32_t h, uint32_t color);
W_EXPORT void     quadro_chalk_draw_line(int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t thickness, uint32_t color);
W_EXPORT void     quadro_chalk_draw_circle(int32_t cx, int32_t cy, int32_t radius, uint32_t color, int32_t filled);
W_EXPORT void     quadro_chalk_draw_text_cmd(int32_t x, int32_t y, const char *str, uint32_t color, int32_t scale);
W_EXPORT void     quadro_chalk_draw_pixel(int32_t x, int32_t y, uint32_t color);
W_EXPORT int32_t  quadro_chalk_get_node_rect(int32_t node_id, int32_t *out_x, int32_t *out_y, int32_t *out_w, int32_t *out_h);

#endif /* QUADRO_CHALK_H */
