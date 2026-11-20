"use client";

import { VartestToolbar, VartestView, useVartestSwitch } from "./vartest-toolbar";

const variants = [
  "Gold circle", "Gold square", "Gold pill", "Outline circle", "Ink circle", "Ink pill", "Soft gold square", "Outline square", "Square mark", "Minimal",
] as const;

/** The saved-change count badge, shown on this heading for visual testing. */
export function ChangeCountBadgeVartest() {
  const { index: variant, direction, goTo: setVariant } = useVartestSwitch(variants.length, 6);

  return (
    <>
      <VartestView key={variant} direction={direction}>
      <h1 className="edy-hero-title">
        Keep the page<br />in <em>view.</em>
        <span className={`edy-change-count edy-change-count-${variant + 1}`} aria-label="3 saved changes">3</span>
      </h1>
      </VartestView>
      <VartestToolbar label="Badge" index={variant} names={variants} onSwitch={setVariant} />
    </>
  );
}
