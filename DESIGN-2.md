---
name: Shunt V2 Theme
description: Modern dark-first design system for Shunt Web App
colors:
  primary: '#454f0c'
  accent: '#ffff03'
  background: '#000000'
  surface-dark: '#0f0f0f'
  surface-dark-alt: '#313131'
  text-primary: '#ffffff'
  text-secondary: 'rgba(255, 255, 255, 0.8)'
  text-muted: '#a3a3a3'
  border-dark: '#313131'
  primary-hover: '#5a6810'
  link-hover: 'rgba(255, 255, 255, 0.8)'
typography:
  display:
    family: 'Inter Tight'
    size: 80px
    weight: 400
    line-height: 1.2
  h1:
    family: 'Inter Tight'
    size: 48px
    weight: 400
    line-height: 1.2
  h2:
    family: 'Inter Tight'
    size: 28px
    weight: 600
    line-height: 110%
  h3:
    family: 'Inter Tight'
    size: 24px
    weight: 500
    line-height: 1.2
  body:
    family: 'Inter'
    size: 14px
    weight: 400
    line-height: 24px
  caption:
    family: 'sans-serif'
    size: 12px
    weight: 400
    line-height: 1.5
spacing:
  base: 4px
  scale: [4, 8, 12, 16, 20, 24, 32, 40]
radius:
  sm: 6px
  md: 10px
  lg: 12px
  xl: 16px
  pill: 62px
  full: 100px
elevation:
  card: 'rgba(0, 0, 0, 0.12) 0px 0.602187px 0.421531px -1px, rgba(0, 0, 0, 0.11) 0px 2.28853px 1.60197px -2px, rgba(0, 0, 0, 0.08) 0px 10px 7px -3px'
  card-hover: 'rgba(0, 0, 0, 0.17) 0px 0.602187px 1.56569px -1.5px, rgba(0, 0, 0, 0.14) 0px 2.28853px 5.95019px -3px, rgba(0, 0, 0, 0.02) 0px 10px 26px -4.5px'
  card-inset: 'rgba(255, 255, 255, 0.08) 0px 17.5px 35px 0px inset, rgba(255, 255, 255, 0.03) 0px -4px 6px 0px inset'
motion:
  duration-base: '0.6s'
  duration-fast: '0.15s'
  easing-standard: 'cubic-bezier(0.44, 0, 0.56, 1)'
components:
  button-primary:
    bg: '{colors.primary}'
    text: '{colors.background}'
    radius: '{radius.pill}'
    padding: '12px 24px'
  button-secondary:
    bg: '{colors.text-primary}'
    text: '{colors.background}'
    border: '1px solid {colors.background}'
    radius: '{radius.md}'
    padding: '8px 10px'
  card:
    bg: '{colors.surface-dark}'
    radius: '{radius.lg}'
    shadow: '{elevation.card}'
---

# Shunt V2 — Design System & Visual Specification

## 1. Visual Theme & Atmosphere

Shunt V2 employs a sophisticated dark-first aesthetic, utilizing a deep black background (`#000000`) that provides a stark canvas for its content. Headings set in `Inter Tight` at sizes up to `80px` command attention, complemented by a subtle olive green accent (`#454f0c`) and a vibrant yellow (`#ffff03`) for highlighting interactive elements and data visualizations. The layout features generous vertical spacing, with cards and containers crafted from a dark gray surface (`#0f0f0f`) and softened by `12px` border radii and subtle dark shadows.

The brand's visual identity is further enhanced by a radial gradient in the hero section, transitioning from dark olive green to black, and the consistent use of line-based, monochrome icons. Interactive elements like links and buttons feature smooth `0.6s cubic-bezier(0.44, 0, 0.56, 1)` color transitions on hover, adding a refined micro-interaction layer. The overall impression is one of a premium, data-focused fintech platform that prioritizes clarity and a polished user experience.

**Key Characteristics**
-   Deep black background (`#000000`) for high contrast.
-   `Inter Tight` display typography up to `80px`.
-   Olive green (`#454f0c`) and bright yellow (`#ffff03`) accents.
-   Rounded cards (`12px` radius) with subtle dark shadows.
-   Generous `32px` to `40px` vertical section spacing.
-   Line-based, monochrome iconography.
-   `0.6s` smooth color transitions on interactive elements.

## 2. Color Palette & Roles

The color palette is built around a dark theme, using contrasting accents to guide user attention and convey professionalism.

-   **Primary**: `#454f0c` (Olive Green) — The main brand color, used for primary call-to-action buttons, hero section gradients, and key highlight elements.
-   **Accent Colors**:
    -   `#ffff03` (Bright Yellow) — A secondary accent used for subtle highlights, progress indicators, and specific interactive elements.
    -   `#313710` (Dark Olive) — A darker shade of the primary green, used for supporting accents and background details.
-   **Interactive**:
    -   `#5a6810` (Primary Hover) — A slightly lighter shade of olive green, used for the hover state of primary interactive elements (inferred from screenshot).
    -   `rgba(255, 255, 255, 0.8)` (Link Hover) — A subtle desaturation of primary white text, used for link hover states (inferred from pseudoStates).
-   **Neutral Scale**:
    -   `#000000` (Deep Black) — The dominant background color across the entire website, providing a deep, immersive canvas.
    -   `#ffffff` (Pure White) — The primary text color, ensuring high readability against dark backgrounds.
    -   `rgba(255, 255, 255, 0.8)` (Subtle White) — Used for secondary text, descriptions, and less prominent information.
    -   `#a3a3a3` (Light Gray) — Muted text for captions, labels, and less critical information, providing a softer contrast.
-   **Surface & Borders**:
    -   `#0f0f0f` (Dark Gray) — Used for card backgrounds, section containers, and other elevated surfaces against the deep black background.
    -   `#313131` (Medium Dark Gray) — A slightly lighter dark gray, used for input fields, borders on dark surfaces, and subtle visual separation.
    -   `#313131` (Border Dark) — Used for subtle borders on cards and input fields, providing structure without harsh lines.

## 3. Typography Rules

-   **Font Family**:
    -   Primary Headings: `'Inter Tight', sans-serif`
    -   Body Text: `'Inter', sans-serif`
    -   Monospace: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace` (inferred)
-   **Hierarchy**:
    -   **Display**: `Inter Tight` `80px` `400` · line-height `1.2` · tracking `none` · Used for prominent hero headlines.
    -   **H1**: `Inter Tight` `48px` `400` · line-height `1.2` · tracking `none` · Main section titles, commanding attention.
    -   **H2**: `Inter Tight` `28px` `600` · line-height `110%` · tracking `-.4px` · Sub-section titles and key feature headings.
    -   **H3**: `Inter Tight` `24px` `500` · line-height `1.2` · tracking `-.01em` · Card titles and prominent sub-headings.
    -   **Body**: `Inter` `14px` `400` · line-height `24px` · tracking `-.01em` · Standard paragraph text for readability.
    -   **Caption**: `sans-serif` `12px` `400` · line-height `1.5` · tracking `none` · Small descriptive text, metadata, and labels.
-   **Principles**:
    -   **Clarity and Impact**: `Inter Tight` is reserved for headings to create a strong, modern visual impact, while `Inter` ensures high readability for body content.
    -   **Generous Line Height**: Ample line-heights, such as `1.2` for display text and `24px` for body text, improve readability on dark backgrounds.
    -   **Subtle Letter Spacing**: Headings utilize subtle negative letter spacing (e.g., `-.4px` for H2) to enhance visual density and refinement.
    -   **Consistent Weighting**: A clear distinction between `400` (Regular), `500` (Medium), and `600` (Semi-Bold) weights helps establish a consistent typographic hierarchy.

## 4. Component Stylings

### Buttons

Buttons are designed for clear interaction, featuring distinct primary, secondary, and ghost variants. Each button includes a `0.15s` `ease-out` transition for smooth feedback.

#### Primary Button
The primary button, like "Get Started for free", features a vibrant olive green background with contrasting black text and a pill-shaped radius.

```css
.button-primary {
  background-color: var(--color-primary, #454f0c);
  color: var(--color-background, #000000);
  font-family: var(--typography-body-family, 'Inter', sans-serif);
  font-size: 12px;
  font-weight: 400;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-pill, 62px);
  cursor: pointer;
  transition: background-color var(--motion-duration-fast, 0.15s) ease-out,
              transform var(--motion-duration-fast, 0.15s) ease-out;
}

.button-primary:hover {
  background-color: var(--color-primary-hover, #5a6810); /* inferred from screenshot */
  transform: translateY(-1px); /* inferred from screenshot */
}

.button-primary:active {
  background-color: var(--color-primary, #454f0c); /* inferred from screenshot */
  transform: translateY(0); /* inferred from screenshot */
}

.button-primary:disabled {
  background-color: var(--color-surface-dark-alt, #313131); /* inferred from screenshot */
  color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
  cursor: not-allowed;
}
```

#### Secondary Button
The secondary button, such as the "Menu" button, has a white background with black text and a subtle border, featuring a `10px` radius.

```css
.button-secondary {
  background-color: var(--color-text-primary, #ffffff);
  color: var(--color-background, #000000);
  font-family: var(--typography-body-family, 'Inter', sans-serif);
  font-size: 12px;
  font-weight: 400;
  padding: 8px 10px;
  border: 1px solid var(--color-background, #000000);
  border-radius: var(--radius-md, 10px);
  cursor: pointer;
  transition: background-color var(--motion-duration-fast, 0.15s) ease-out,
              color var(--motion-duration-fast, 0.15s) ease-out,
              border-color var(--motion-duration-fast, 0.15s) ease-out;
}

.button-secondary:hover {
  background-color: var(--color-surface-dark-alt, #313131); /* inferred from screenshot */
  color: var(--color-text-primary, #ffffff); /* inferred from screenshot */
  border-color: var(--color-surface-dark-alt, #313131); /* inferred from screenshot */
}

.button-secondary:active {
  background-color: var(--color-background, #000000); /* inferred from screenshot */
  color: var(--color-text-primary, #ffffff); /* inferred from screenshot */
  border-color: var(--color-background, #000000); /* inferred from screenshot */
}

.button-secondary:disabled {
  background-color: var(--color-surface-dark-alt, #313131); /* inferred from screenshot */
  color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
  border-color: var(--color-surface-dark-alt, #313131); /* inferred from screenshot */
  cursor: not-allowed;
}
```

#### Ghost Button
Ghost buttons, like "Learn More" links, are text-only, transparent, and rely on subtle color changes for interaction.

```css
.button-ghost {
  background-color: transparent;
  color: var(--color-text-primary, #ffffff);
  font-family: var(--typography-body-family, 'Inter', sans-serif);
  font-size: 12px;
  font-weight: 400;
  padding: 0;
  border: none;
  border-radius: 0;
  cursor: pointer;
  text-decoration: none;
  transition: color var(--motion-duration-fast, 0.15s) ease-out;
}

.button-ghost:hover {
  color: var(--color-link-hover, rgba(255, 255, 255, 0.8)); /* inferred from screenshot */
}

.button-ghost:active {
  color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
}

.button-ghost:disabled {
  color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
  cursor: not-allowed;
}
```

### Cards & Containers

Cards are dark, elevated surfaces that organize content, featuring a `12px` border radius and a subtle shadow.

#### Standard Card
Standard cards use the `surface-dark` background, `text-primary` for content, and a `card` elevation shadow. On hover, the shadow intensifies slightly.

```css
.card {
  background-color: var(--color-surface-dark, #0f0f0f);
  color: var(--color-text-primary, #ffffff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--elevation-card, rgba(0, 0, 0, 0.12) 0px 0.602187px 0.421531px -1px, rgba(0, 0, 0, 0.11) 0px 2.28853px 1.60197px -2px, rgba(0, 0, 0, 0.08) 0px 10px 7px -3px);
  padding: 24px; /* inferred from screenshot */
  transition: box-shadow var(--motion-duration-base, 0.6s) var(--motion-easing-standard, cubic-bezier(0.44, 0, 0.56, 1));
}

.card:hover {
  box-shadow: var(--elevation-card-hover, rgba(0, 0, 0, 0.17) 0px 0.602187px 1.56569px -1.5px, rgba(0, 0, 0, 0.14) 0px 2.28853px 5.95019px -3px, rgba(0, 0, 0, 0.02) 0px 10px 26px -4.5px);
}
```

### Inputs & Forms

Form elements maintain the dark theme, ensuring consistency and clear interaction states.

#### Text Input
Text inputs have a dark background, white text, and a subtle border, with a `6px` radius. Focus states are highlighted with a distinct outline.

```css
.text-input {
  background-color: var(--color-surface-dark-alt, #313131);
  color: var(--color-text-primary, #ffffff);
  font-family: var(--typography-body-family, 'Inter', sans-serif);
  font-size: 14px;
  font-weight: 400;
  padding: 12px 16px; /* inferred from screenshot */
  border: 1px solid var(--color-border-dark, #313131);
  border-radius: var(--radius-sm, 6px);
  transition: border-color var(--motion-duration-fast, 0.15s) ease-out,
              box-shadow var(--motion-duration-fast, 0.15s) ease-out;
}

.text-input:focus {
  outline: none;
  border-color: var(--color-primary, #454f0c); /* inferred from screenshot */
  box-shadow: 0 0 0 2px rgba(69, 79, 12, 0.5); /* inferred from screenshot */
}

.text-input:disabled {
  background-color: var(--color-surface-dark, #0f0f0f); /* inferred from screenshot */
  color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
  cursor: not-allowed;
}
```

#### Form Label
Form labels use muted text to clearly identify input fields.

```css
.form-label {
  color: var(--color-text-muted, #a3a3a3);
  font-family: var(--typography-body-family, 'Inter', sans-serif);
  font-size: 12px;
  font-weight: 400;
  margin-bottom: 4px; /* inferred from screenshot */
  display: block;
}
```

#### Checkbox/Radio
(none observed in source)

### Navigation

The navigation system provides clear pathways through the site, with distinct states for links.

#### Top Navigation Bar
The top navigation bar is a minimal, dark strip that provides access to core site sections.

```css
.nav-bar {
  background-color: var(--color-background, #000000);
  padding: 16px 40px; /* inferred from screenshot */
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-surface-dark-alt, #313131); /* inferred from screenshot */
}
```

#### Navigation Link
Navigation links are subtle white text, becoming slightly less opaque on hover and using the primary green for the active state.

```css
.nav-link {
  color: var(--color-text-primary, #ffffff);
  font-family: var(--typography-body-family, 'Inter', sans-serif);
  font-size: 14px;
  font-weight: 400;
  text-decoration: none;
  padding: 8px 12px; /* inferred from screenshot */
  transition: color var(--motion-duration-fast, 0.15s) ease-out;
}

.nav-link:hover {
  color: var(--color-link-hover, rgba(255, 255, 255, 0.8));
}

.nav-link.active,
.nav-link[aria-current="page"] {
  color: var(--color-primary, #454f0c); /* inferred from screenshot */
  font-weight: 500; /* inferred from screenshot */
}
```

#### Dropdown Menu
(none observed in source)

### Links

Standard and secondary links provide clear navigation within text content.

#### Standard Link
Standard links are white text, underlined, with a subtle fade on hover.

```css
.link-standard {
  color: var(--color-text-primary, #ffffff);
  text-decoration: underline;
  text-decoration-color: var(--color-text-primary, #ffffff); /* inferred from screenshot */
  transition: color var(--motion-duration-fast, 0.15s) ease-out,
              text-decoration-color var(--motion-duration-fast, 0.15s) ease-out;
}

.link-standard:hover {
  color: var(--color-link-hover, rgba(255, 255, 255, 0.8));
  text-decoration-color: var(--color-link-hover, rgba(255, 255, 255, 0.8));
}

.link-standard:visited {
  color: var(--color-text-primary, #ffffff); /* inferred from screenshot */
  text-decoration-color: var(--color-text-primary, #ffffff); /* inferred from screenshot */
}
```

#### Secondary Link
Secondary links use muted text, ideal for less prominent references.

```css
.link-secondary {
  color: var(--color-text-muted, #a3a3a3);
  text-decoration: underline;
  text-decoration-color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
  transition: color var(--motion-duration-fast, 0.15s) ease-out,
              text-decoration-color var(--motion-duration-fast, 0.15s) ease-out;
}

.link-secondary:hover {
  color: var(--color-link-hover, rgba(255, 255, 255, 0.8)); /* inferred from screenshot */
  text-decoration-color: var(--color-link-hover, rgba(255, 255, 255, 0.8)); /* inferred from screenshot */
}

.link-secondary:visited {
  color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
  text-decoration-color: var(--color-text-muted, #a3a3a3); /* inferred from screenshot */
}
```

### Badges

Badges are used for small, informative labels, like the "Popular" tag.

#### Status Badge - Popular
The "Popular" badge uses the primary olive green background with white text and a full pill-shaped radius.

```css
.badge-popular {
  background-color: var(--color-primary, #454f0c);
  color: var(--color-text-primary, #ffffff);
  font-family: var(--typography-caption-family, 'sans-serif');
  font-size: 12px;
  font-weight: 400;
  padding: 4px 8px; /* inferred from screenshot */
  border-radius: var(--radius-full, 100px);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

## 5. Layout Principles

-   **Spacing System**: The layout uses a `4px` base unit for its spacing system, creating a consistent rhythm across the interface.
    -   Base: `4px`
    -   Scale: `[4, 8, 12, 16, 20, 24, 32, 40]`
    -   Usage Context:
        -   `4px`: Smallest element spacing, icon-text separation.
        -   `8px`: Inline element spacing, input field padding.
        -   `12px`: Minor vertical spacing, button padding (e.g., secondary button).
        -   `16px`: Component internal padding, spacing between small cards.
        -   `20px`: Moderate spacing, paragraph margins.
        -   `24px`: Section padding, spacing between major components.
        -   `32px`: Larger section spacing, vertical rhythm.
        -   `40px`: Hero section padding, significant content separation.
-   **Grid & Container** *(Suggested — not measured)*: _Note: container widths and column counts are not extracted from the source. The values below are reasonable defaults inferred from the visible layout density._
    -   Max Width: `1200px` (inferred from screenshot)
    -   Columns: `12` (inferred for flexible content arrangement)
    -   Gutter: `24px` (inferred for clear column separation)
    -   Section Padding: `64px 0` (vertical padding on sections, inferred from screenshot)
-   **Whitespace Philosophy**: The design leverages a dark background with abundant whitespace, particularly vertical spacing, to give content room to breathe and enhance focus. This minimalist approach emphasizes the primary content and interactive elements, preventing visual clutter and contributing to a premium feel.
-   **Border Radius Scale**:
    -   `sm`: `6px` — Used for small interactive elements or subtle rounding.
    -   `md`: `10px` — Standard for buttons (e.g., secondary button).
    -   `lg`: `12px` — Applied to cards and larger containers.
    -   `xl`: `16px` — For prominent containers or hero elements (inferred from screenshot).
    -   `pill`: `62px` — Used for highly rounded, pill-shaped buttons (e.g., primary button).
    -   `full`: `100px` — For perfectly circular elements or badges.

## 6. Depth & Elevation

Shunt V2 uses subtle shadows on its dark surfaces to create a sense of depth and hierarchy, with specific z-index values for stacking contexts.

-   **Flat (z-0)**: `none` — Used for background elements or content that lies flush with the page.
-   **Card (z-1)**: `rgba(0, 0, 0, 0.12) 0px 0.602187px 0.421531px -1px, rgba(0, 0, 0, 0.11) 0px 2.28853px 1.60197px -2px, rgba(0, 0, 0, 0.08) 0px 10px 7px -3px` — Applied to standard cards and containers.
-   **Interactive (z-2)**: `rgba(0, 0, 0, 0.17) 0px 0.602187px 1.56569px -1.5px, rgba(0, 0, 0, 0.14) 0px 2.28853px 5.95019px -3px, rgba(0, 0, 0, 0.02) 0px 10px 26px -4.5px` — For hover states on cards, indicating interactivity.
-   **Overlay (z-10)**: `rgba(0, 0, 0, 0.5) 0px 0px 0px 9999px` (inferred from screenshot) — Used for modal backdrops or dropdown menus.
-   **System (z-2147483647)**: `rgba(0, 0, 0, 0.2) 0px 4px 12px` (inferred from screenshot) — Reserved for critical system-level UI elements like notifications or toasts.

**Shadow Philosophy**: Shadows are subtle and dark, primarily serving to lift elements slightly from the `background` (`#000000`) without introducing harsh lines. Inset shadows, like `rgba(255, 255, 255, 0.08) 0px 17.5px 35px 0px inset`, are used sparingly to create internal glows or depth within specific components.

## 7. Do's and Don'ts

### Do's
-   **Do** use `Inter Tight` with `80px` size and `400` weight for hero display text on the `#000000` background.
-   **Do** apply the `primary` color (`#454f0c`) for the background of the Primary Button, ensuring text is `#000000`.
-   **Do** maintain `24px` of vertical spacing between `card` components.
-   **Do** use `Inter` `14px` `400` with `24px` line-height for all body text on `#000000` backgrounds.
-   **Do** ensure all interactive elements, like the Primary Button, use a `0.15s ease-out` transition for state changes.
-   **Do** use `12px` border radius for `card` components and `62px` for `button-primary` to maintain consistency.
-   **Do** use `#ffffff` for primary text on `#000000` backgrounds; the contrast ratio is 21:1, passing AAA.
-   **Do** use `#a3a3a3` for muted text on `#0f0f0f` surfaces; the contrast ratio is 7.6:1, passing AAA.
-   **Do** use `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px` from the spacing scale for all layout decisions.

### Don'ts
-   **Don't** use `#a3a3a3` text on `#ffffff` backgrounds; the contrast ratio is 2.52:1, which fails AA.
-   **Don't** introduce custom spacing values; adhere strictly to the `4px` based spacing scale.
-   **Don't** use `Inter Tight` for body text; reserve it for headings to maintain visual hierarchy.
-   **Don't** use harsh or bright shadows; stick to the subtle dark `elevation.card` and `elevation.card-hover` values.
-   **Don't** use `primary` color (`#454f0c`) for borders; use `border-dark` (`#313131`) for subtle outlines.
-   **Don't** make links a different color than `#ffffff` or `rgba(255, 255, 255, 0.8)` on dark backgrounds; maintain brand color consistency.
-   **Don't** use a border radius other than `10px` for the Secondary Button.
-   **Don't** use font weights outside of `400`, `500`, `600` for `Inter Tight` and `Inter` families.
-   **Don't** apply `box-shadow` to text inputs in their default state; only apply the focus ring on `:focus`.

## 8. Responsive Behavior *(Suggested — not measured)*

_Note: breakpoints below are industry-standard recommendations, not measurements from the source. Adjust to the brand's actual media queries when implementing._

-   **Suggested Breakpoints**:
    -   **Mobile Small** (~375px): Stacks all content vertically, scales typography down.
    -   **Mobile Large** (~809px): Navigation transforms to hamburger menu, cards stack in single column.
    -   **Tablet** (~1199px): Grid adjusts to 2-3 columns, main typography scales up slightly.
    -   **Desktop** (~1440px): Full desktop layout, ample spacing and multi-column grids.
    -   **Desktop Large** (~1920px): Expands content area slightly, maintains core layout.
-   **Touch Targets**:
    -   Ensure all interactive elements, like buttons and links, have a minimum touch target size of `44px` by `44px`.
    -   Maintain at least `12px` of clear space around touch targets to prevent accidental taps.
-   **Collapsing Strategy**:
    -   Navigation: The primary navigation bar collapses into a hamburger menu icon below `809px`.
    -   Cards: Multi-column card layouts transition to a single-column stack on mobile viewports.
    -   Typography: Display and H1 headings dynamically scale down to smaller `Inter Tight` sizes (e.g., `48px` to `32px`) on smaller screens.
    -   Padding: Horizontal padding on sections and containers reduces from `40px` to `16px` on mobile.
    -   Forms: Input fields maintain full width, labels stack above inputs for clarity.
    -   Spacing: Vertical spacing values from the `40px` to `24px` range are often halved on mobile.

## 9. Agent Prompt Guide

-   **Quick Color Reference**
    -   `primary`: `#454f0c`
    -   `accent`: `#ffff03`
    -   `background`: `#000000`
    -   `surface-dark`: `#0f0f0f`
    -   `surface-dark-alt`: `#313131`
    -   `text-primary`: `#ffffff`
    -   `text-secondary`: `rgba(255, 255, 255, 0.8)`
    -   `text-muted`: `#a3a3a3`
    -   `border-dark`: `#313131`
    -   `primary-hover`: `#5a6810`
    -   `link-hover`: `rgba(255, 255, 255, 0.8)`
-   **Iteration Guide**:
    1.  Always use `Inter Tight` for headings and `Inter` for body text.
    2.  All primary CTAs (e.g., Primary Button) must use `background-color: {colors.primary}` and `color: {colors.background}` with `border-radius: {radius.pill}`.
    3.  Ensure all text on `#000000` backgrounds uses `#ffffff` or `rgba(255, 255, 255, 0.8)` for readability.
    4.  Apply `box-shadow: {elevation.card}` to all standard card components, transitioning to `box-shadow: {elevation.card-hover}` on `:hover`.
    5.  Utilize the `spacing.scale` values `[4, 8, 12, 16, 20, 24, 32, 40]` for all element and section spacing.
    6.  Set `border-radius: {radius.lg}` (`12px`) for all cards and `border-radius: {radius.md}` (`10px`) for secondary buttons.
    7.  Implement `transition: background-color var(--motion-duration-fast, 0.15s) ease-out` for all button hover states.
    8.  Text inputs must have `background-color: {colors.surface-dark-alt}` and a `2px` `rgba(69, 79, 12, 0.5)` focus ring.
    9.  Navigation links should use `color: {colors.text-primary}` and change to `color: {colors.link-hover}` on hover.
    10. Ensure body text on `#000000` (`#ffffff` on `#000000`) and muted text on `#0f0f0f` (`#a3a3a3` on `#0f0f0f`) pass AAA contrast.
    11. On mobile, collapse the main navigation into a hamburger menu and stack multi-column layouts.
    12. Use `Inter Tight` `80px` `400` line-height `1.2` for the main display heading.

## 10. Smooth Scrolling Specification (Lenis)

- **Engine**: Lenis (`lenis` / `@studio-freight/lenis`).
- **Scope**: Landing Page (`/` / `Onboarding`).
- **Configuration**:
  - `duration`: `1.2s` (Provides a weighted, luxurious inertial scroll feeling).
  - `easing`: `(t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))` (Smooth exponential deceleration).
  - `smoothWheel`: `true` (Intercepts and smooths mousewheel/trackpad scroll events).
- **Implementation Note**: Lenis is initialized inside the Landing Page component (`Onboarding.tsx`) via React `useEffect` and cleaned up on unmount so dashboard/internal screens retain native quick scrolling.