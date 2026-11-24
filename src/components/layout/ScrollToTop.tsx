/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop component ensures that you are scrolled to the top 
 * whenever the location (URL path) changes.
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Standard window scroll reset
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant", // Use instant to avoid jumping while content is still animating in
    });
  }, [pathname]);

  return null;
};
