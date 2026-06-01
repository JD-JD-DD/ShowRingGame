import type { CSSProperties } from "react";
import type { ShowDistrictRegion } from "@showring/rules";

/**
 * Region panels use a district's permanent identity color. Travel distance is
 * shown separately so a district does not visually change from page to page.
 */
export function getDistrictPanelStyle(
  region: Pick<ShowDistrictRegion, "accentColor">
): CSSProperties {
  return {
    borderColor: `${region.accentColor}99`,
    backgroundColor: `${region.accentColor}1f`,
    boxShadow: `0 0 0 1px ${region.accentColor}1a`
  };
}

export function getDistrictBadgeStyle(
  region: Pick<ShowDistrictRegion, "accentColor">
): CSSProperties {
  return {
    borderColor: `${region.accentColor}99`,
    backgroundColor: `${region.accentColor}24`,
    color: region.accentColor
  };
}
