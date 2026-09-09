# Page topology

Six layout sections: 60px header; 150px sidebar; dismissible 45px announcement; flexible library panel; 280px community panel; 20px footer.
The viewport is fixed-height. Library and community scroll independently. No page parallax, scroll snapping, or scroll-driven tabs were observed.

At 1440×900 the library starts at x166/y121 and community at x1144/y121. At 768px the sidebar remains and the community disappears. At 390px the sidebar is replaced by a 62px bottom navigation; the alert is two lines, the footer/filters/search/view controls are hidden, and book cards occupy one column. The implementation uses 767px and 1199px breakpoints to reproduce those observed states.

First-visit guide: fixed full-screen gradient overlay; desktop two cards and a secondary skip panel; cards stack below 1024px. Creation modal overlays the workbench. Appearance popover opens beneath the palette button.
