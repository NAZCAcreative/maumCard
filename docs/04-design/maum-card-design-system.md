---
name: Maum Card Design System
colors:
  surface: '#fff8f7'
  surface-dim: '#e2d8d7'
  surface-bright: '#fff8f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf1f1'
  surface-container: '#f6ebeb'
  surface-container-high: '#f0e6e5'
  surface-container-highest: '#eae0e0'
  on-surface: '#1f1a1b'
  on-surface-variant: '#564241'
  inverse-surface: '#342f2f'
  inverse-on-surface: '#f9eeee'
  outline: '#897170'
  outline-variant: '#dcc0bf'
  surface-tint: '#a13d3f'
  primary: '#a13d3f'
  on-primary: '#ffffff'
  primary-container: '#f47c7c'
  on-primary-container: '#6c151c'
  inverse-primary: '#ffb3b1'
  secondary: '#765751'
  on-secondary: '#ffffff'
  secondary-container: '#fdd3cb'
  on-secondary-container: '#795953'
  tertiary: '#645e4f'
  on-tertiary: '#ffffff'
  tertiary-container: '#a79f8d'
  on-tertiary-container: '#3b3629'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b1'
  on-primary-fixed: '#410007'
  on-primary-fixed-variant: '#82252a'
  secondary-fixed: '#ffdad3'
  secondary-fixed-dim: '#e6bdb6'
  on-secondary-fixed: '#2c1611'
  on-secondary-fixed-variant: '#5c403a'
  tertiary-fixed: '#ebe2ce'
  tertiary-fixed-dim: '#cfc6b3'
  on-tertiary-fixed: '#1f1b0f'
  on-tertiary-fixed-variant: '#4c4638'
  background: '#fff8f7'
  on-background: '#1f1a1b'
  surface-variant: '#eae0e0'
typography:
  display-lg:
    fontFamily: beVietnamPro
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: beVietnamPro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: beVietnamPro
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: plusJakartaSans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: plusJakartaSans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: plusJakartaSans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: plusJakartaSans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: beVietnamPro
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 20px
  margin-desktop: 40px
  gutter: 16px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 40px
---

## Brand & Style

The design system is centered on the concept of "Digital Sincerity"—bridging the gap between modern convenience and the tactile warmth of a handwritten letter. It targets users who value emotional connection, from young adults celebrating milestones to older generations sharing wisdom.

The visual style is a blend of **Modern Minimalism** and **Tactile Warmth**. It avoids the sterile coldness often found in tech by using generous whitespace, soft edges, and a palette inspired by natural elements like petals and paper. The emotional response should be one of calm, comfort, and invitation, ensuring the process of creating a card feels as thoughtful as the message within it.

## Colors

The color strategy uses a "Warm Bloom" approach.

- **Primary (Soft Coral) `#a13d3f`:** Used for key actions and emotional highlights. It provides enough contrast for accessibility while maintaining a friendly, non-aggressive tone.
- **Secondary (Pastel Pink) `#765751`:** Acts as a supportive tint for surfaces, active states, and decorative elements.
- **Tertiary (Warm Beige) `#645e4f`:** Serves as the primary background color to simulate the feel of high-quality stationery paper, reducing eye strain compared to pure white.
- **Neutral (Warm Charcoal) `#1f1a1b`:** Used for text and icons to ensure high legibility while remaining softer and more organic than true black.

Functional colors (Success, Error) should be tempered with the same warm undertones to maintain the system's harmony.

## Typography

This design system utilizes **Be Vietnam Pro** for headlines to provide a contemporary yet friendly character, and **Plus Jakarta Sans** for body and UI labels to ensure maximum readability with a soft, rounded aesthetic.

The hierarchy is structured to guide the user through the "story" of card creation. Use `display-lg` sparingly for onboarding or empty states. All text should utilize the `Neutral` color token or its variants to maintain a soft, approachable look. For the actual "card content" (handwritten portions), the system supports secondary script-based fonts to provide a tactile, human touch.

**Letter Spacing Rules:**
- Display: `-0.02em` — tight tracking creates premium feel at large sizes
- Headline LG: `-0.01em` — slightly tighter for editorial authority
- Body/Label: default or positive — ensures legibility at small sizes

## Layout & Spacing

The layout philosophy is **Stationery-Inspired Fluidity**. Components are treated as layers on a page.

- **Grid:** A 4-column fluid grid for mobile and a 12-column fixed-max-width grid for tablet/desktop (centered).
- **Safe Margins:** A generous 20px margin on mobile prevents the UI from feeling cramped.
- **Rhythm:** An 8px base unit drives all spacing. Use `stack-lg` (40px) to separate major content sections to emphasize the minimalist, "breathing" aesthetic.
- **Reflow:** On larger screens, card previews transition from a single-column stack to a multi-column masonry grid to maximize visual discovery.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows** rather than harsh borders.

- **Level 0 (Base):** The warm beige background (`#fff8f7`).
- **Level 1 (Cards):** Pure white surfaces with a very soft, diffused shadow using 12% opacity Primary color tint — `0 1px 3px rgba(161,61,63,0.08), 0 4px 12px -2px rgba(161,61,63,0.10)`.
- **Level 2 (Floating / FAB):** Elements like floating action buttons use a slightly deeper shadow with a 4px vertical offset — `0 4px 16px -2px rgba(161,61,63,0.18), 0 2px 6px rgba(161,61,63,0.06)`.
- **Backdrop Blur:** Use a subtle 10px blur on top navigation bars to maintain context of the scrollable content beneath while keeping the text legible.

## Shapes

The shape language is consistently **Rounded**, reflecting the soft nature of the brand.

- **Small Components (Buttons, Chips):** Use `rounded-lg` (16px) to maintain a friendly, touch-optimized appearance.
- **Large Components (Cards, Modals):** Use `rounded-xl` (24px) to create a distinct "container" feel that mimics rounded-corner stationery.
- **Iconography:** Icons should feature rounded caps and corners (2px stroke width) to match the softness of the typography.

## Components

- **Buttons:** Primary buttons use a solid `Primary` fill with white text. Secondary buttons use a `Secondary` fill with `Primary` text. All buttons have a height of 56px for mobile accessibility.
- **Cards:** High-engagement cards (like card templates) should use a 3:4 aspect ratio. Use a subtle 1px inner border in a lighter tint of the Neutral color to define edges on white backgrounds.
- **Input Fields:** Use a "filled" style with the `Secondary` color at 20% opacity. Upon focus, the border transitions to the `Primary` color.
- **Chips/Filters:** Use pill-shaped containers. The active state is indicated by a solid `Secondary` fill and `Primary` text.
- **Lists:** Items are separated by whitespace and soft tonal changes rather than hard divider lines to maintain a clean aesthetic.
- **Greeting Card Preview:** A specific component that mimics the physical card, utilizing a subtle center-fold shadow to provide a sense of depth and realism.
- **Senior-friendly CTA rule:** Primary action buttons in list rows should be large, high-contrast, and visually primary. Place the CTA before secondary status chips like D-day, use at least `text-sm` with `h-10` or higher, and avoid tiny pill buttons for the main action.

## Surface Container Scale

The surface container scale is used to create visual hierarchy without color changes. Each level represents a slightly deeper tonal surface:

| Token | Value | Use |
|-------|-------|-----|
| surface-container-lowest | `#ffffff` | Pure white modals, inputs |
| surface-container-low | `#fcf1f1` | Subtle tinted inputs, quiet sections |
| surface-container | `#f6ebeb` | Standard card backgrounds, chips |
| surface-container-high | `#f0e6e5` | Elevated interactive states |
| surface-container-highest | `#eae0e0` | Strong tonal emphasis |
