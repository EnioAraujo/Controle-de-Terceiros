# Design System Document

## 1. Overview & Creative North Star: "Kinetic Precision"

This design system is built for a high-end logistics and corporate environment where movement meets absolute reliability. We are moving away from the static, "templated" feel of traditional industrial sites toward an **Editorial Modernism** approach. 

The Creative North Star is **"Kinetic Precision."** 

Logistics is about the choreography of movement. To reflect this, the UI must feel dynamic yet controlled. We achieve this through:
*   **Intentional Asymmetry:** Using the spacing scale to offset elements, breaking the standard "center-aligned" corporate grid.
*   **Layered Narrative:** Treating the interface as a series of physical planes that overlap, mimicking the stacking and flow of global commerce.
*   **Typographic Authority:** High-contrast scale shifts that guide the eye with editorial confidence.

---

## 2. Colors & Tonal Architecture

Our palette is anchored by a high-energy brand orange and a sophisticated range of architectural greys. The goal is to use color to define space, not just decoration.

### The "No-Line" Rule
To maintain a premium, seamless aesthetic, **1px solid borders are prohibited for sectioning.** Boundaries between content blocks must be defined solely through background color shifts. For example, a `surface-container-low` section should sit directly against a `surface` background to create a clean, modern break.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack. Use the surface-container tiers (`lowest` to `highest`) to create nested depth:
*   **Page Background:** `surface` (#faf9fb).
*   **Section Blocks:** `surface-container-low` (#f4f3f5).
*   **Content Cards:** `surface-container-lowest` (#ffffff) to provide a "lifted" feel.
*   **Interactive Overlays:** `surface-container-high` (#e8e8ea).

### The "Glass & Gradient" Rule
Floating navigation and status indicators should utilize **Glassmorphism**. Apply a semi-transparent `surface_variant` with a 12px-20px backdrop blur. For main CTAs and hero backgrounds, move beyond flat colors by applying a subtle linear gradient from `primary` (#a04100) to `primary_container` (#f26f23) at a 135-degree angle. This provides a "visual soul" and metallic luster appropriate for the logistics sector.

---

## 3. Typography

The typography strategy pairs technical precision with human-centric readability.

*   **Display & Headlines (Space Grotesk):** This is our "Industrial Voice." It is geometric and authoritative. Use `display-lg` for hero statements with tight letter-spacing (-2%) to mimic high-end editorial layouts.
*   **Titles & Body (Plus Jakarta Sans):** Our "Functional Voice." It provides a sophisticated, modern warmth. `body-lg` is the standard for narrative text, ensuring high legibility in dense logistical data.
*   **Labels (Inter):** Reserved for technical data points, small captions, and UI metadata. It is the "Utility Voice."

**Hierarchy Note:** Always maintain a minimum of two scale jumps between adjacent text elements (e.g., pair a `headline-lg` with `body-lg`) to ensure clear visual intent.

---

## 4. Elevation & Depth

We eschew traditional drop shadows in favor of **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by stacking surface tokens. A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural, soft lift without the "muddy" look of heavy shadows.
*   **Ambient Shadows:** If a floating effect is mandatory (e.g., a primary modal), use an ultra-diffused shadow: `box-shadow: 0 20px 40px rgba(26, 28, 29, 0.06);`. The shadow color must be a tinted version of `on-surface` to feel integrated with the environment.
*   **The "Ghost Border" Fallback:** For accessibility in form fields, use the `outline-variant` token at **20% opacity**. Never use 100% opaque, high-contrast borders.
*   **The Kinetic Wireframe:** As seen in the reference imagery, use thin, large-radius `primary` colored outlines (0.5px to 1px) that partially overlap image containers. This creates a "blueprint" feel that reinforces the theme of planning and precision.

---

## 5. Components

### Buttons
*   **Primary:** `primary_container` background with `on_primary_container` text. Use `rounded-md` (0.375rem). The padding should be generous: `spacing-4` (vertical) and `spacing-8` (horizontal).
*   **Secondary:** `secondary_container` background. No border.
*   **Tertiary:** Transparent background with `primary` text. Use for low-emphasis actions like "Read More."

### Cards
*   **Construction:** Forbid divider lines. Use `spacing-6` of vertical whitespace to separate header from body. 
*   **Visual Motif:** Cards should use `rounded-lg` (0.5rem). In a grid, vary the vertical alignment of cards slightly (using the spacing scale) to create a more dynamic, less "stock" appearance.

### Input Fields
*   **State:** Use `surface-container-highest` for the background. 
*   **Interaction:** On focus, transition the background to `surface-container-lowest` and apply a 1px "Ghost Border" using the `primary` token at 30% opacity.

### Kinetic Stats (Special Component)
For logistics metrics (e.g., "+0mil m²"), use a large `display-md` weight. Place these on a `surface-container-lowest` card with a subtle `primary` accent bar (4px) on the left edge only.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical white space to lead the eye through complex information.
*   **Do** overlap image elements with "Ghost Outlines" to create a sense of depth and architectural planning.
*   **Do** use the `primary_container` (Orange) sparingly as a "heat map" for the most important actions.
*   **Do** rely on background color shifts for section transitions.

### Don't
*   **Don't** use 1px solid black or dark grey borders to separate sections.
*   **Don't** use standard "drop shadows" with high opacity; keep elevations tonal.
*   **Don't** center-align everything. Use the spacing scale to create intentional left-heavy or right-heavy layouts.
*   **Don't** use the brand orange for body text; keep orange reserved for interaction and primary headlines only.

---

## 7. Spacing & Rhythm

All layouts must adhere to a strict 4px/8px baseline grid, but with **Aggressive Padding.** To achieve a "High-End" feel, increase the default padding of sections to `spacing-24` (6rem). This "breathing room" communicates luxury and professional confidence, distinguishing the design from crowded, low-cost logistics templates.