# AskSia Behaviors

- Header is fixed at the top. At scrollY 0 and ~950px it remains 80px high with a white background and a subtle shadow; the shadow increases slightly while scrolling.
- Desktop nav groups are click-driven dropdowns. Clicking `学生专区`, `实用工具`, or `资源` opens its menu and selecting a link closes it.
- Mobile navigation is click-driven: the desktop nav is hidden and `Menu` opens a rounded overlay with the same groups as expandable details.
- Back-to-school banner has a dismiss button with accessible label `Dismiss back to school promotion`; dismissing removes the banner.
- Hero buttons are CTA links/buttons. In this local emulation they anchor to the product section or remain a visual Chrome CTA; no real login or download flow is implemented.
- Product tabs are click-driven and update the selected visual state. Clicking a tab smooth-scrolls the matching product panel into view; all five panels remain available for natural page scrolling.
- FAQ items are native disclosure/details controls. The first answer is always visible; other questions expand and collapse on click.
- Logo and exam strips are continuous CSS marquee animations. They pause only when the page is not rendered; no user input is required.
- Product mockups are static HTML/CSS illustrations of the observed web, mobile, extension, library and agent surfaces. They do not call APIs.
- Responsive behavior: desktop uses full nav, two-column product rows and floating review cards; mobile uses Menu, single-column product rows, smaller mockups, horizontal table scrolling and two-column footer links.
