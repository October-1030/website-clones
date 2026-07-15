import { storyboundMarkup } from "@/content/storybound-markup";

import { StoryboundInteractions } from "./StoryboundInteractions";

export function StoryboundLanding() {
  return (
    <>
      <div
        className="storybound-root"
        dangerouslySetInnerHTML={{ __html: storyboundMarkup }}
      />
      <StoryboundInteractions />
    </>
  );
}
