# AuthShell specification

Target: src/components/auth-shell.tsx. References: original-login-desktop.png, original-login-tablet.png, original-login-mobile.png.
Static background and mount animation. Main fixed inset 0, viewport width/height. Pseudo element background /images/login-background.png centered cover no-repeat z-index -1.
Form outer full-height flex justify-end. Inner desktop width 36%, pl40px, center vertically. <=768px full width, px20px, justify center.
Panel flex, width420px max100%, padding45px 50px, border2px #fff, radius25px, backdrop blur10px, inset shadow0 0 20px #fff. <=768px width100% max400px padding40px 30px. <=480px padding30px 20px.
Panel entrance .6s cubic-bezier(.25,.46,.45,.94): opacity0/translateX30px to opacity1/translateX0.
Children fill panel width. Login footer fixed bottom20px center full width, text 必火AI · GEO智能营销平台, 13px/19.5px white70%, text-shadow0 1px 2px black20%. Registration no footer.
Use named exports, Tailwind utility classes, no inline styles.
