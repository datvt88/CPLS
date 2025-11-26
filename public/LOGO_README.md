# Logo Files

## Current Implementation

The webapp currently uses an SVG logo (`logo.svg`) that provides a placeholder design matching the "Cổ Phiếu Lướt Sóng" branding with:
- Green wave/circle design
- Purple upward arrow with sparkles
- "CỔ PHIẾU" and "LƯỚT SÓNG" text

## Replacing with Final Logo

To use the final logo design from Google Drive or other sources:

1. **Option 1: Replace SVG**
   - Save your final logo as `logo.svg` in this `/public` directory
   - Ensure it maintains transparent background for best results
   - Recommended dimensions: 400x100px or similar wide aspect ratio

2. **Option 2: Use PNG**
   - Save your logo as `logo.png` in this `/public` directory
   - Update component imports to use `.png` instead of `.svg`:
     - `components/Sidebar.tsx`
     - `components/MobileMenu.tsx`
     - `components/Header.tsx`
   - Recommended: Use transparent background PNG
   - Recommended dimensions: 800x200px (2x for retina displays)

## Responsive Sizing

The logo is displayed with responsive sizing:
- **Sidebar (Desktop)**: 128-160px width, 32-40px height
- **Mobile Menu**: 144px width, 40px height
- **Header (Mobile)**: 96-112px width, 24-28px height

The design uses Next.js Image component with `object-contain` to maintain aspect ratio.
