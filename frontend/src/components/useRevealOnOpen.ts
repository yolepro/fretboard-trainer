// A card that unfolds near the bottom of a list scrolls into view (Défis, the challenge setups).
// The list's views report their layout (y relative to their parent); once the card has unfolded, if it is not
// entirely on screen, the list scrolls so the card's top sits near the top of the screen.
import { useEffect, useRef } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

const UNFOLD_MS = 320; // a little longer than the Unfold animation (260 ms)
const MARGIN = 12;

export function useRevealOnOpen(openKey: string | null) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const viewH = useRef(0);
  const boxes = useRef(new Map<string, { y: number; h: number; parent?: string }>());

  const topOf = (key: string): number | null => {
    let y = 0;
    let k: string | undefined = key;
    for (let guard = 0; k && guard < 10; guard++) {
      const b = boxes.current.get(k);
      if (!b) return null;
      y += b.y;
      k = b.parent;
    }
    return y;
  };

  useEffect(() => {
    if (!openKey) return;
    const id = setTimeout(() => {
      const top = topOf(openKey);
      const box = boxes.current.get(openKey);
      if (top === null || !box || !viewH.current) return;
      const bottom = top + box.h;
      const visible = top >= scrollY.current && bottom <= scrollY.current + viewH.current;
      if (!visible) scrollRef.current?.scrollTo({ y: Math.max(0, top - MARGIN), animated: true });
    }, UNFOLD_MS);
    return () => clearTimeout(id);
  }, [openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    /** Spread on the ScrollView. */
    scroll: {
      ref: scrollRef,
      scrollEventThrottle: 32,
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      },
      onLayout: (e: LayoutChangeEvent) => {
        viewH.current = e.nativeEvent.layout.height;
      },
    },
    /** onLayout of a view in the list: `parent` = the key of the view it sits in (none: directly in the list). */
    at: (key: string, parent?: string) => (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      boxes.current.set(key, { y, h: height, parent });
    },
  };
}
