# Modern CSS Patterns Reference Guide

Quick reference for the modern CSS patterns applied across all enhanced apps.

---

## 1. Button Styling Pattern

### Base Button with Accessibility
```css
button {
  padding: 15px 30px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;                          /* Touch target */
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

button:hover {
  transform: translateY(-2px);                /* Lift effect */
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2); /* Elevation */
}

button:active {
  transform: translateY(0);                   /* Press effect */
}

button:focus {
  outline: 2px solid currentColor;            /* Keyboard nav */
  outline-offset: 2px;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Primary Action Button
```css
.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}
```

### Secondary Button
```css
.btn-secondary {
  background: #f3f4f6;
  color: #333;
}

.btn-secondary:hover {
  background: #e5e7eb;
}
```

### Danger Button
```css
.btn-danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.btn-danger:hover {
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
  transform: scale(1.05);
}
```

---

## 2. Input & Form Control Pattern

### Modern Text Input
```css
input[type="text"],
input[type="email"],
textarea {
  padding: 14px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  color: #333;
  line-height: 1.5;
  font-family: inherit;
  transition: all 0.3s;
  background: white;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
}

input::placeholder,
textarea::placeholder {
  color: #999;
}
```

### Checkbox with Theme Color
```css
input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: #10b981;  /* Theme-specific */
}
```

---

## 3. Animation Patterns

### Smooth Hover Scale
```css
.scale-on-hover {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scale-on-hover:hover {
  transform: scale(1.05);
}

.scale-on-hover:active {
  transform: scale(0.98);
}
```

### Slide-In Animation
```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.slide-in {
  animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Fade-In Animation
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  animation: fadeIn 0.4s ease-out;
}
```

### Pulse Animation (Loading)
```css
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.pulse {
  animation: pulse 1.5s ease-in-out infinite;
}
```

### Bounce on Number Change
```css
@keyframes pulse-number {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.pulse-number {
  animation: pulse-number 0.6s ease-in-out;
}
```

---

## 4. Gradient Patterns

### Blue-Purple Gradient (Calculator, Weather)
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Green Gradient (Todo)
```css
background: linear-gradient(135deg, #10b981 0%, #059669 100%);
```

### Amber Gradient (Note)
```css
background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
```

### Red-Green Pomodoro
```css
/* Work mode */
background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);

/* Break mode */
background: linear-gradient(135deg, #10b981 0%, #059669 100%);
```

### Button Gradients
```css
/* Green action */
background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);

/* Orange */
background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);

/* Red */
background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
```

---

## 5. Shadow & Depth Patterns

### Subtle Shadow
```css
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
```

### Medium Shadow
```css
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
```

### Elevated Shadow
```css
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
```

### Deep Shadow (Cards)
```css
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
```

### Colored Shadow
```css
box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);  /* Blue */
box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);   /* Green */
box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);   /* Amber */
```

### Inset Shadow (Progress Bar)
```css
box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
```

---

## 6. Responsive Design Patterns

### Mobile-First Flex Container
```css
#container {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 600px) {
  #container {
    flex-direction: column;
    gap: 10px;
  }
}
```

### Grid with Auto-Fill
```css
#grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

@media (max-width: 768px) {
  #grid {
    grid-template-columns: 1fr;
  }
}
```

### Touch-Friendly Buttons
```css
button {
  min-height: 44px;           /* WCAG Touch target */
  min-width: 44px;
  padding: 12px 24px;
}

@media (max-width: 480px) {
  button {
    padding: 14px 20px;       /* Slightly more on mobile */
  }
}
```

### Text Scaling on Mobile
```css
h1 {
  font-size: 36px;
}

@media (max-width: 600px) {
  h1 {
    font-size: 28px;          /* 77% of desktop size */
  }
}
```

---

## 7. Accessibility Patterns

### Focus Indicators
```css
button:focus,
input:focus,
a:focus {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}
```

### High Contrast on Disabled
```css
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #d1d5db;
}
```

### Skip Link Pattern
```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #333;
  color: white;
  padding: 8px;
  border-radius: 0 0 4px 0;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

### Visually Hidden but Accessible
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### High Contrast Mode Support
```css
@media (prefers-contrast: more) {
  button {
    border: 2px solid currentColor;
  }
}
```

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Typography Patterns

### Readable Body Text
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #333;
}
```

### Monospace for Numbers (Timer)
```css
#timer {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
  font-size: 96px;
  font-weight: 700;
  letter-spacing: 6px;
}
```

### Heading Hierarchy
```css
h1 {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 30px;
}

h2 {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 20px;
}

h3 {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 16px;
}
```

### Text Emphasis
```css
.label {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

---

## 9. Card & Container Patterns

### Modern Card
```css
.card {
  background: white;
  border-radius: 14px;
  padding: 22px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  border-left: 4px solid #f59e0b;  /* Accent border */
}

.card:hover {
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
  transform: translateY(-4px);
}
```

### Elevated Container
```css
.container {
  background: white;
  border-radius: 20px;
  padding: 35px;
  box-shadow: 0 20px 60px rgba(102, 126, 234, 0.25);
  max-width: 500px;
  width: 100%;
}
```

### Light Background Section
```css
.section {
  background: #f3f4f6;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
}
```

---

## 10. Transition & Duration Patterns

### Standard Interaction Duration
```css
transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Quick Feedback
```css
transition: all 0.2s ease-out;
```

### Smooth Animation
```css
transition: width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
```

### Delayed Hover Effect
```css
transition: all 0.3s;
transition-delay: 0.05s;
```

---

## 11. Color Palette Reference

### Primary Colors
| App | Primary | Secondary | Accent |
|-----|---------|-----------|--------|
| Calculator | #667eea | #764ba2 | #4caf50 |
| Todo | #10b981 | #059669 | #ef4444 |
| Pomodoro | #ef4444 / #10b981 | - | Orange |
| Note | #f59e0b | #d97706 | - |
| Weather | #667eea | #764ba2 | - |

### Neutral Scale
```css
White:    #ffffff
Light:    #f3f4f6
Lighter:  #e5e7eb
Medium:   #d1d5db
Dark:     #6b7280
Darker:   #374151
Black:    #1f2937
```

### Semantic Colors
```css
Success:  #4caf50
Warning:  #ff9800
Error:    #ef4444
Info:     #667eea
```

---

## 12. Quick Snippets

### Smooth Scroll
```css
html {
  scroll-behavior: smooth;
}
```

### No Selection Drag
```css
user-select: none;
```

### Smooth Rendering
```css
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### Zero Out Everything
```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
```

### Container Query Support
```css
@supports (container-type: inline-size) {
  .container {
    container-type: inline-size;
  }
}
```

---

## Testing Easing Functions

### Visual Easing Test
```css
/* Copy different easing functions to test */

/* Linear */
transition: all 0.3s linear;

/* Ease-out (default browser) */
transition: all 0.3s ease-out;

/* Custom bouncy */
transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);

/* Smooth ease-in-out */
transition: all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);

/* Sharp ease-in */
transition: all 0.3s cubic-bezier(0.4, 0, 1, 1);
```

Use [cubic-bezier.com](https://cubic-bezier.com) to visualize and customize timing functions.

---

## Browser Support

All patterns use standard CSS features with broad support:
- ✅ CSS Grid (IE 11 partial, modern browsers full)
- ✅ Flexbox (All modern browsers)
- ✅ CSS Transitions (All modern browsers)
- ✅ CSS Gradients (All modern browsers)
- ✅ Box Shadows (All modern browsers)
- ✅ Border Radius (All modern browsers)
- ✅ CSS Variables (IE 11 not supported, but graceful)
- ✅ RGBA Colors (All modern browsers)

---

## Performance Tips

1. **Use transform for animations** - GPU accelerated, no repaints
2. **Avoid animating width/height** - Triggers layout calculations
3. **Use will-change sparingly** - For known animation targets
4. **Batch DOM changes** - Avoid repeated reflows
5. **Debounce resize events** - Don't recalculate constantly
6. **Use CSS over JavaScript** - When possible

```css
/* Good - GPU accelerated */
@keyframes slide {
  to { transform: translateX(100px); }
}

/* Bad - Triggers layout */
@keyframes slide {
  to { left: 100px; }
}
```

---

## Final Checklist

- [ ] All buttons have focus indicators
- [ ] Minimum 44px touch targets
- [ ] Color contrast >= 4.5:1
- [ ] Animations respect prefers-reduced-motion
- [ ] Transitions use GPU-friendly properties
- [ ] Responsive layouts tested at 375px, 768px, 1024px
- [ ] System fonts used for performance
- [ ] Semantic HTML elements used
- [ ] ARIA labels provided where needed
- [ ] Mobile-first approach followed

