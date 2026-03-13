import { useState, useCallback, useMemo, useRef } from 'react';

/** Manages multi-select state with shift-click range selection.
 * @returns Selection state and actions: toggle, rangeSelect, selectAll, clear, isSelected, selectedIds, selectedCount.
 */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<string | null>(null);

  const toggle = useCallback((id: string) => {
    lastClickedRef.current = id;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rangeSelect = useCallback((id: string, orderedIds: string[]) => {
    const lastId = lastClickedRef.current;
    lastClickedRef.current = id;
    if (!lastId) {
      setSelected(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      return;
    }
    const startIdx = orderedIds.indexOf(lastId);
    const endIdx = orderedIds.indexOf(id);
    if (startIdx === -1 || endIdx === -1) return;
    const lo = Math.min(startIdx, endIdx);
    const hi = Math.max(startIdx, endIdx);
    setSelected(prev => {
      const next = new Set(prev);
      for (let i = lo; i <= hi; i++) next.add(orderedIds[i]);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    lastClickedRef.current = null;
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const selectedIds = useMemo(() => [...selected], [selected]);

  return { selectedIds, selectedCount: selected.size, toggle, rangeSelect, selectAll, clear, isSelected } as const;
}
