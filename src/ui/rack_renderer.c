/**
 * =========================================================================
 * BRACK Hardware Modular Renderer (src/ui/rack_renderer.c)
 * Pure C / Quadro-based Eurorack Visualizer & Cable Physics Engine
 * =========================================================================
 */

#include "rack_ui.h"
#include "brack_dsp.h"

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#endif

static ui_rack_state_t g_ui = {0};
static uint32_t s_fb_memory[1280 * 720]; // 720p maximum buffer

/* =========================================================================
 * Fast Software 2D Drawing Primitives
 * ========================================================================= */

static inline uint32_t ui_blend_pixel(uint32_t src, uint32_t dst) {
    uint32_t sa = (src >> 24) & 0xFF;
    if (sa == 0) return dst;
    if (sa == 255) return src;

    uint32_t inv_sa = 255 - sa;
    uint32_t sr = src & 0xFF, sg = (src >> 8) & 0xFF, sb = (src >> 16) & 0xFF;
    uint32_t dr = dst & 0xFF, dg = (dst >> 8) & 0xFF, db = (dst >> 16) & 0xFF;

    uint32_t r = (sr * sa + dr * inv_sa) / 255;
    uint32_t g = (sg * sa + dg * inv_sa) / 255;
    uint32_t b = (sb * sa + db * inv_sa) / 255;

    return 0xFF000000 | (b << 16) | (g << 8) | r;
}

static void ui_fill_rect(int x0, int y0, int w, int h, uint32_t color) {
    int x1 = x0 + w;
    int y1 = y0 + h;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > g_ui.width) x1 = g_ui.width;
    if (y1 > g_ui.height) y1 = g_ui.height;

    for (int y = y0; y < y1; y++) {
        uint32_t *row = &g_ui.framebuffer[y * g_ui.width + x0];
        int count = x1 - x0;
        for (int x = 0; x < count; x++) {
            row[x] = color;
        }
    }
}

static void ui_draw_circle_filled(int cx, int cy, int radius, uint32_t color) {
    int r2 = radius * radius;
    int y0 = cy - radius; if (y0 < 0) y0 = 0;
    int y1 = cy + radius; if (y1 >= g_ui.height) y1 = g_ui.height - 1;

    for (int y = y0; y <= y1; y++) {
        int dy = y - cy;
        int dx_limit = w_isqrt(r2 - dy * dy);
        int x0 = cx - dx_limit; if (x0 < 0) x0 = 0;
        int x1 = cx + dx_limit; if (x1 >= g_ui.width) x1 = g_ui.width - 1;

        uint32_t *row = &g_ui.framebuffer[y * g_ui.width];
        for (int x = x0; x <= x1; x++) {
            row[x] = ui_blend_pixel(color, row[x]);
        }
    }
}

static void ui_draw_circle_outline(int cx, int cy, int radius, int thickness, uint32_t color) {
    int r_outer2 = radius * radius;
    int r_inner2 = (radius - thickness) * (radius - thickness);
    int y0 = cy - radius; if (y0 < 0) y0 = 0;
    int y1 = cy + radius; if (y1 >= g_ui.height) y1 = g_ui.height - 1;

    for (int y = y0; y <= y1; y++) {
        int dy = y - cy;
        int dy2 = dy * dy;
        int dx_out = w_isqrt(r_outer2 - dy2);
        int dx_in  = (r_inner2 > dy2) ? w_isqrt(r_inner2 - dy2) : 0;

        int x0_left  = cx - dx_out;
        int x1_left  = cx - dx_in;
        int x0_right = cx + dx_in;
        int x1_right = cx + dx_out;

        uint32_t *row = &g_ui.framebuffer[y * g_ui.width];
        for (int x = x0_left; x <= x1_left; x++) {
            if (x >= 0 && x < g_ui.width) row[x] = ui_blend_pixel(color, row[x]);
        }
        for (int x = x0_right; x <= x1_right; x++) {
            if (x >= 0 && x < g_ui.width) row[x] = ui_blend_pixel(color, row[x]);
        }
    }
}

static void ui_draw_thick_line(int x0, int y0, int x1, int y1, int thickness, uint32_t color) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    int steps = w_isqrt(dx * dx + dy * dy);
    if (steps <= 0) return;

    int rad = thickness / 2;
    for (int i = 0; i <= steps; i++) {
        int x = x0 + (dx * i) / steps;
        int y = y0 + (dy * i) / steps;
        ui_draw_circle_filled(x, y, rad, color);
    }
}

/**
 * Natural Hanging Cable Catenary / Quadratic Bezier Curve with Drop Shadow
 */
static void ui_draw_hanging_cable(int x0, int y0, int x1, int y1, uint32_t color, int is_shadow) {
    int dx = x1 - x0;
    int dy = y1 - y0;
    int dist = w_isqrt(dx * dx + dy * dy);
    
    // Sag gravity calculation
    int sag = 40 + dist / 3;
    if (sag > 140) sag = 140;

    int mid_x = (x0 + x1) / 2;
    int mid_y = (y0 > y1 ? y0 : y1) + sag;

    if (is_shadow) {
        y0 += 16;
        y1 += 16;
        mid_y += 18;
        color = 0x60000000; // Semi-transparent black shadow
    }

    int steps = dist / 3 + 24;
    if (steps < 20) steps = 20;

    int prev_x = x0;
    int prev_y = y0;

    for (int i = 1; i <= steps; i++) {
        int t = (i * 1024) / steps;
        int it = 1024 - t;

        // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
        int px = (it * it * x0 + 2 * it * t * mid_x + t * t * x1) / (1024 * 1024);
        int py = (it * it * y0 + 2 * it * t * mid_y + t * t * y1) / (1024 * 1024);

        ui_draw_thick_line(prev_x, prev_y, px, py, is_shadow ? 7 : 5, color);
        prev_x = px;
        prev_y = py;
    }
}

/* =========================================================================
 * Hardware Component Renderers (Knobs, Jacks, Faceplates, Screws, LEDs)
 * ========================================================================= */

static void ui_draw_screw(int x, int y) {
    ui_draw_circle_filled(x, y, 4, 0xFF1e2025);
    ui_draw_circle_filled(x, y, 3, 0xFF5a606e);
    ui_draw_circle_filled(x, y, 2, 0xFF7a8292);
    // Screw slot
    ui_draw_thick_line(x - 2, y, x + 2, y, 1, 0xFF1e2025);
}

static void ui_draw_knob(ui_knob_t *knob) {
    int x = knob->x;
    int y = knob->y;
    int r = knob->radius;

    // 1. Tick marks around knob (270-degree arc from -135 to +135 deg)
    for (int deg = -135; deg <= 135; deg += 30) {
        int sin_t = 0, cos_t = 0;
        w_sincos_deg(deg + 90, &sin_t, &cos_t);
        int tx0 = x + ((r + 3) * cos_t) / 1024;
        int ty0 = y + ((r + 3) * sin_t) / 1024;
        int tx1 = x + ((r + 7) * cos_t) / 1024;
        int ty1 = y + ((r + 7) * sin_t) / 1024;
        ui_draw_thick_line(tx0, ty0, tx1, ty1, 1, 0xFF505565);
    }

    // 2. Drop shadow
    ui_draw_circle_filled(x + 1, y + 2, r, 0x80000000);

    // 3. Metallic Outer Bevel
    ui_draw_circle_filled(x, y, r, 0xFF2a2d36);
    ui_draw_circle_filled(x, y, r - 1, 0xFF1f2128);

    // 4. Shaded Knob Cap
    ui_draw_circle_filled(x, y, r - 3, 0xFF353945);

    // 5. Pointer Notch (Angle based on value: -135deg to +135deg)
    int angle_deg = -135 + (int)(knob->value * 270.0f);
    int sin_p = 0, cos_p = 0;
    w_sincos_deg(angle_deg + 90, &sin_p, &cos_p);
    int nx0 = x + ((r - 8) * cos_p) / 1024;
    int ny0 = y + ((r - 8) * sin_p) / 1024;
    int nx1 = x + ((r - 2) * cos_p) / 1024;
    int ny1 = y + ((r - 2) * sin_p) / 1024;

    ui_draw_thick_line(nx0, ny0, nx1, ny1, 2, 0xFFff4757); // Glowing red/orange pointer
}

static void ui_draw_jack(ui_jack_t *jack) {
    int x = jack->x;
    int y = jack->y;

    // Drop shadow
    ui_draw_circle_filled(x + 1, y + 1, 9, 0x60000000);

    // Outer Hex Nut / Metallic Bezel
    ui_draw_circle_filled(x, y, 9, 0xFF747d8c);
    ui_draw_circle_filled(x, y, 8, 0xFFa4b0be);

    // Color Ring for Signal Type (Audio = Blue, CV = Orange, Gate = Red)
    uint32_t ring_color = 0xFF1e90ff;
    if (jack->sig_type == SIGNAL_CV) ring_color = 0xFFffa502;
    else if (jack->sig_type == SIGNAL_GATE) ring_color = 0xFFff4757;

    ui_draw_circle_filled(x, y, 6, ring_color);

    // Inner 3.5mm Socket Hole
    ui_draw_circle_filled(x, y, 4, 0xFF0b0c10);
    ui_draw_circle_filled(x - 1, y - 1, 2, 0xFF1a1c24);
}

/* =========================================================================
 * Visual Rack Public API
 * ========================================================================= */

W_EXPORT void ui_rack_init(int32_t width, int32_t height) {
    g_ui.width = (width > 0 && width <= 1280) ? width : 1024;
    g_ui.height = (height > 0 && height <= 720) ? height : 480;
    g_ui.framebuffer = s_fb_memory;
    g_ui.module_count = 0;
    g_ui.knob_count = 0;
    g_ui.jack_count = 0;
    g_ui.cable_count = 0;
    g_ui.is_dragging_cable = 0;
}

W_EXPORT uint32_t* ui_rack_get_framebuffer(void) {
    return g_ui.framebuffer;
}

W_EXPORT void ui_rack_resize(int32_t width, int32_t height) {
    if (width > 0 && width <= 1280) g_ui.width = width;
    if (height > 0 && height <= 720) g_ui.height = height;
}

W_EXPORT int32_t ui_rack_add_module(int32_t slot_id, const char *name, int32_t hp, uint32_t bg_color) {
    if (g_ui.module_count >= UI_MAX_UI_MODS) return -1;
    int idx = g_ui.module_count++;
    ui_module_t *m = &g_ui.modules[idx];
    m->slot_id = slot_id;
    m->hp = hp;
    m->width = hp * UI_HP_WIDTH;
    m->bg_color = (bg_color != 0) ? bg_color : 0xFF1e2029; // Brushed dark aluminum
    
    // Compute X position by summing previous module widths
    int x_acc = 30; // Left rail margin
    for (int i = 0; i < idx; i++) {
        x_acc += g_ui.modules[i].width + 2;
    }
    m->x = x_acc;
    m->y = 40; // Top rail margin

    int c = 0;
    while (name && name[c] && c < 19) {
        m->name[c] = name[c];
        c++;
    }
    m->name[c] = 0;
    return idx;
}

W_EXPORT int32_t ui_rack_add_knob(int32_t mod_idx, int32_t param_id, int32_t rel_x, int32_t rel_y, int32_t radius, float def_val, float min_v, float max_v, const char *label) {
    if (g_ui.knob_count >= UI_MAX_KNOBS || mod_idx >= g_ui.module_count) return -1;
    int idx = g_ui.knob_count++;
    ui_knob_t *k = &g_ui.knobs[idx];
    k->id = idx;
    k->mod_idx = mod_idx;
    k->param_id = param_id;
    k->x = g_ui.modules[mod_idx].x + rel_x;
    k->y = g_ui.modules[mod_idx].y + rel_y;
    k->radius = (radius > 4) ? radius : 14;
    k->min_val = min_v;
    k->max_val = max_v;
    k->value = (max_v > min_v) ? (def_val - min_v) / (max_v - min_v) : 0.5f;

    int c = 0;
    while (label && label[c] && c < 11) { k->label[c] = label[c]; c++; }
    k->label[c] = 0;
    return idx;
}

W_EXPORT int32_t ui_rack_add_jack(int32_t mod_idx, int32_t port_id, int32_t is_output, int32_t sig_type, int32_t rel_x, int32_t rel_y, const char *label) {
    if (g_ui.jack_count >= UI_MAX_JACKS || mod_idx >= g_ui.module_count) return -1;
    int idx = g_ui.jack_count++;
    ui_jack_t *j = &g_ui.jacks[idx];
    j->id = idx;
    j->mod_idx = mod_idx;
    j->port_id = port_id;
    j->is_output = is_output;
    j->sig_type = sig_type;
    j->x = g_ui.modules[mod_idx].x + rel_x;
    j->y = g_ui.modules[mod_idx].y + rel_y;

    int c = 0;
    while (label && label[c] && c < 11) { j->label[c] = label[c]; c++; }
    j->label[c] = 0;
    return idx;
}

W_EXPORT int32_t ui_rack_add_cable(int32_t src_jack_id, int32_t dst_jack_id, uint32_t color) {
    if (g_ui.cable_count >= UI_MAX_CABLES) return -1;
    int idx = g_ui.cable_count++;
    ui_cable_t *c = &g_ui.cables[idx];
    c->src_jack_id = src_jack_id;
    c->dst_jack_id = dst_jack_id;
    c->color = (color != 0) ? color : 0xFFffa502;
    c->active = 1;
    return idx;
}

W_EXPORT void ui_rack_remove_cable(int32_t cable_id) {
    if (cable_id >= 0 && cable_id < g_ui.cable_count) {
        g_ui.cables[cable_id].active = 0;
    }
}

W_EXPORT void ui_rack_clear_cables(void) {
    g_ui.cable_count = 0;
}

/* =========================================================================
 * Hit Testing & Mouse Drag Handling
 * ========================================================================= */

W_EXPORT int32_t ui_rack_hit_test(int32_t x, int32_t y, int32_t *out_item_id) {
    // 1. Check Jacks first (12px hit radius)
    for (int i = 0; i < g_ui.jack_count; i++) {
        int dx = x - g_ui.jacks[i].x;
        int dy = y - g_ui.jacks[i].y;
        if (dx * dx + dy * dy <= 12 * 12) {
            if (out_item_id) *out_item_id = i;
            return UI_HIT_JACK;
        }
    }

    // 2. Check Knobs
    for (int i = 0; i < g_ui.knob_count; i++) {
        int dx = x - g_ui.knobs[i].x;
        int dy = y - g_ui.knobs[i].y;
        int r = g_ui.knobs[i].radius + 2;
        if (dx * dx + dy * dy <= r * r) {
            if (out_item_id) *out_item_id = i;
            return UI_HIT_KNOB;
        }
    }

    // 3. Check Modules
    for (int i = 0; i < g_ui.module_count; i++) {
        ui_module_t *m = &g_ui.modules[i];
        if (x >= m->x && x <= m->x + m->width && y >= m->y && y <= m->y + UI_RACK_HEIGHT) {
            if (out_item_id) *out_item_id = i;
            return UI_HIT_PANEL;
        }
    }

    return UI_HIT_NONE;
}

W_EXPORT void ui_rack_mouse_down(int32_t x, int32_t y) {
    int item_id = -1;
    int hit = ui_rack_hit_test(x, y, &item_id);

    g_ui.mouse_x = x;
    g_ui.mouse_y = y;
    g_ui.active_drag_type = hit;
    g_ui.active_drag_id = item_id;

    if (hit == UI_HIT_JACK) {
        g_ui.drag_cable_src_jack = item_id;
        g_ui.is_dragging_cable = 1;
    }
}

W_EXPORT void ui_rack_mouse_move(int32_t x, int32_t y, float *out_param_change) {
    int dy = g_ui.mouse_y - y; // Drag up increases value
    g_ui.mouse_x = x;
    g_ui.mouse_y = y;

    if (g_ui.active_drag_type == UI_HIT_KNOB && g_ui.active_drag_id >= 0) {
        ui_knob_t *k = &g_ui.knobs[g_ui.active_drag_id];
        float delta = (float)dy * 0.005f;
        k->value = b_clamp(k->value + delta, 0.0f, 1.0f);
        if (out_param_change) {
            *out_param_change = k->min_val + k->value * (k->max_val - k->min_val);
        }
    }
}

W_EXPORT int32_t ui_rack_mouse_up(int32_t x, int32_t y, int32_t *out_connected_src, int32_t *out_connected_dst) {
    int result = 0;
    if (g_ui.is_dragging_cable && g_ui.drag_cable_src_jack >= 0) {
        int target_jack = -1;
        int hit = ui_rack_hit_test(x, y, &target_jack);
        if (hit == UI_HIT_JACK && target_jack != g_ui.drag_cable_src_jack) {
            // Determine cable color based on source jack signal type
            uint32_t color = 0xFF1e90ff; // Blue Audio
            if (g_ui.jacks[g_ui.drag_cable_src_jack].sig_type == SIGNAL_CV) color = 0xFFffa502; // Orange CV
            else if (g_ui.jacks[g_ui.drag_cable_src_jack].sig_type == SIGNAL_GATE) color = 0xFFff4757; // Red Gate

            ui_rack_add_cable(g_ui.drag_cable_src_jack, target_jack, color);
            if (out_connected_src) *out_connected_src = g_ui.drag_cable_src_jack;
            if (out_connected_dst) *out_connected_dst = target_jack;
            result = 1;
        }
    }

    g_ui.active_drag_type = UI_HIT_NONE;
    g_ui.active_drag_id = -1;
    g_ui.is_dragging_cable = 0;
    g_ui.drag_cable_src_jack = -1;
    return result;
}

/* =========================================================================
 * Full Rack Render Pass (60 FPS)
 * ========================================================================= */

W_EXPORT void ui_rack_render(const float *scope_l, uint32_t scope_len) {
    int w = g_ui.width;
    int h = g_ui.height;

    // 1. Clear background (Dark Studio Backdrop)
    ui_fill_rect(0, 0, w, h, 0xFF0b0c10);

    // 2. Top & Bottom Wooden/Metallic 19" Rails
    ui_fill_rect(20, 28, w - 40, 12, 0xFF2d3436);
    ui_fill_rect(20, 40 + UI_RACK_HEIGHT, w - 40, 12, 0xFF2d3436);

    // 3. Render Module Faceplates
    for (int i = 0; i < g_ui.module_count; i++) {
        ui_module_t *m = &g_ui.modules[i];

        // Panel Body
        ui_fill_rect(m->x, m->y, m->width, UI_RACK_HEIGHT, m->bg_color);

        // Panel Border Chamfers
        ui_fill_rect(m->x, m->y, 1, UI_RACK_HEIGHT, 0xFF3d4251);
        ui_fill_rect(m->x + m->width - 1, m->y, 1, UI_RACK_HEIGHT, 0xFF14161c);

        // Module Header Band
        ui_fill_rect(m->x, m->y + 2, m->width, 24, 0xFF161820);
        ui_fill_rect(m->x, m->y + 26, m->width, 1, 0xFFff4757); // Accent red divider

        // Faceplate Mounting Screws (Top & Bottom)
        ui_draw_screw(m->x + 8, m->y + 12);
        ui_draw_screw(m->x + m->width - 8, m->y + 12);
        ui_draw_screw(m->x + 8, m->y + UI_RACK_HEIGHT - 12);
        ui_draw_screw(m->x + m->width - 8, m->y + UI_RACK_HEIGHT - 12);
    }

    // 4. Render Knobs
    for (int i = 0; i < g_ui.knob_count; i++) {
        ui_draw_knob(&g_ui.knobs[i]);
    }

    // 5. Render Jacks
    for (int i = 0; i < g_ui.jack_count; i++) {
        ui_draw_jack(&g_ui.jacks[i]);
    }

    // 6. Render Oscilloscope Screen (if scope data provided)
    if (scope_l && scope_len > 0) {
        int sc_x = 35;
        int sc_y = 40 + UI_RACK_HEIGHT - 70;
        int sc_w = 120;
        int sc_h = 50;

        ui_fill_rect(sc_x, sc_y, sc_w, sc_h, 0xFF050608);
        ui_fill_rect(sc_x, sc_y + sc_h / 2, sc_w, 1, 0xFF151820);

        int prev_sx = sc_x;
        int prev_sy = sc_y + sc_h / 2;
        int step = (scope_len > sc_w) ? (scope_len / sc_w) : 1;

        for (int x = 0; x < sc_w; x++) {
            int s_idx = (x * step) % scope_len;
            float val = scope_l[s_idx];
            int sy = sc_y + sc_h / 2 - (int)(val * (sc_h / 2 - 2));
            if (sy < sc_y) sy = sc_y;
            if (sy >= sc_y + sc_h) sy = sc_y + sc_h - 1;

            ui_draw_thick_line(prev_sx, prev_sy, sc_x + x, sy, 1, 0xFF2ed573);
            prev_sx = sc_x + x;
            prev_sy = sy;
        }
    }

    // 7. Render Connected Patch Cables (First drop shadows, then colored wires)
    for (int pass = 0; pass < 2; pass++) {
        for (int i = 0; i < g_ui.cable_count; i++) {
            ui_cable_t *c = &g_ui.cables[i];
            if (!c->active) continue;

            int x0 = g_ui.jacks[c->src_jack_id].x;
            int y0 = g_ui.jacks[c->src_jack_id].y;
            int x1 = g_ui.jacks[c->dst_jack_id].x;
            int y1 = g_ui.jacks[c->dst_jack_id].y;

            ui_draw_hanging_cable(x0, y0, x1, y1, c->color, pass == 0);
        }
    }

    // 8. Render Currently Dragged Cable (if user is dragging a wire)
    if (g_ui.is_dragging_cable && g_ui.drag_cable_src_jack >= 0) {
        int x0 = g_ui.jacks[g_ui.drag_cable_src_jack].x;
        int y0 = g_ui.jacks[g_ui.drag_cable_src_jack].y;
        int x1 = g_ui.mouse_x;
        int y1 = g_ui.mouse_y;

        ui_draw_hanging_cable(x0, y0, x1, y1, 0x80000000, 1);
        ui_draw_hanging_cable(x0, y0, x1, y1, 0xFFff4757, 0);
    }
}
