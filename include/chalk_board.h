#ifndef CHALK_BOARD_H
#define CHALK_BOARD_H

/**
 * =========================================================================
 * BRACK Chalkboard Visual Engine (include/chalk_board.h)
 * Pure C / Quadro-based Blackboard Node Graph with Chalk Brush Textures
 * =========================================================================
 */

#include <stdint.h>
#include <stddef.h>
#include "quadro.h"

#define MAX_CHALK_NODES    48
#define MAX_CHALK_LINKS    96
#define MAX_INPUT_ENTRIES  8
#define MAX_CHALK_SLIDERS  8

/* Chalk Colors */
#define CHALK_WHITE   0xFFf1f2f6
#define CHALK_YELLOW  0xFFffeaa7
#define CHALK_CYAN    0xFF81ecec
#define CHALK_PINK    0xFFff7675
#define CHALK_GREEN   0xFF55efc4
#define CHALK_PURPLE  0xFFa29bfe
#define CHALK_ORANGE  0xFFfab1a0

typedef struct {
    int32_t src_node_id;
    int32_t src_port;
    int32_t dst_port;
    float   amount;        /* Modulation depth / Send level */
    char    src_name[16];
} chalk_input_entry_t;

typedef struct {
    int32_t param_id;
    char    name[12];
    float   value;        /* 0.0 .. 1.0 */
    float   min_val;
    float   max_val;
} chalk_slider_t;

typedef struct {
    int32_t  id;
    int32_t  slot_id;
    char     name[20];
    uint32_t chalk_color;
    
    // Position on blackboard
    int32_t  x;
    int32_t  y;
    int32_t  w;
    int32_t  h;

    // Dynamic list of received incoming inputs (SunVox style)
    chalk_input_entry_t inputs[MAX_INPUT_ENTRIES];
    int32_t             input_count;

    // Sliders / Parameters
    chalk_slider_t      sliders[MAX_CHALK_SLIDERS];
    int32_t             slider_count;

    // Live Chalk Scope Buffer
    float    scope_data[48];
    uint8_t  active;
} chalk_node_t;

typedef struct {
    int32_t  src_node;
    int32_t  dst_node;
    uint32_t chalk_color;
    uint8_t  active;
} chalk_link_t;

typedef struct {
    int32_t       width;
    int32_t       height;
    
    chalk_node_t  nodes[MAX_CHALK_NODES];
    int32_t       node_count;

    chalk_link_t  links[MAX_CHALK_LINKS];
    int32_t       link_count;

    // Interaction State
    int32_t       drag_mode;      // 0=None, 1=Move Node, 2=Chalk Wire Drag, 3=Slider Drag
    int32_t       active_node_id;
    int32_t       active_slider_id;
    int32_t       wire_src_node;
    int32_t       mouse_x;
    int32_t       mouse_y;
    int32_t       drag_off_x;
    int32_t       drag_off_y;

    uint32_t      chalk_seed;
    uint32_t      anim_frame;
} chalk_board_state_t;

/* C / WASM ABI Exports */
W_EXPORT void     chalk_board_init(int32_t width, int32_t height);
W_EXPORT uint32_t* chalk_board_get_framebuffer(void);
W_EXPORT void     chalk_board_resize(int32_t width, int32_t height);

// Node Setup
W_EXPORT int32_t  chalk_board_add_node(int32_t slot_id, const char *name, uint32_t color, int32_t x, int32_t y, int32_t w, int32_t h);
W_EXPORT int32_t  chalk_board_add_slider(int32_t node_id, int32_t param_id, const char *name, float def_v, float min_v, float max_v);

// Dynamic Input Connections
W_EXPORT int32_t  chalk_board_connect(int32_t src_node, int32_t dst_node, float amount, uint32_t color);
W_EXPORT void     chalk_board_disconnect(int32_t src_node, int32_t dst_node);
W_EXPORT void     chalk_board_clear(void);

// Scope Feed
W_EXPORT void     chalk_board_feed_scope(int32_t node_id, const float *samples, uint32_t count);

// Mouse Interaction
W_EXPORT void     chalk_board_mouse_down(int32_t x, int32_t y);
W_EXPORT int32_t  chalk_board_mouse_move(int32_t x, int32_t y, int32_t *out_slot, int32_t *out_param, float *out_val);
W_EXPORT int32_t  chalk_board_mouse_up(int32_t x, int32_t y, int32_t *out_src_slot, int32_t *out_dst_slot);

// Frame Render Loop (Quadro Engine with Chalk Brushes & Grain)
W_EXPORT void     chalk_board_render(void);

#endif /* CHALK_BOARD_H */
