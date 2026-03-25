interface Props {
  onBack?: () => void;
  canGoBack?: boolean;
  gridColumns?: number;
  onToggleGrid?: () => void;
  showViewToggle?: boolean;
  // Admin selection props
  isAdmin?: boolean;
  selectMode?: boolean;
  onToggleSelectMode?: () => void;
  selectedCount?: number;
  totalCount?: number;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onTrashSelected?: () => void;
}

export default function WindowToolbar({
  onBack, canGoBack, gridColumns, onToggleGrid, showViewToggle,
  isAdmin, selectMode, onToggleSelectMode,
  selectedCount = 0, totalCount = 0, onSelectAll, onDeselectAll, onTrashSelected,
}: Props) {
  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <button
          style={{ ...styles.navBtn, opacity: canGoBack ? 1 : 0.3 }}
          onClick={onBack}
          disabled={!canGoBack}
          title="Back"
        >
          &#9665;
        </button>
        {showViewToggle && (
          <button style={styles.viewBtn} onClick={onToggleGrid} title={`Grid: ${gridColumns} columns`}>
            &#9638; {gridColumns} col
          </button>
        )}
      </div>
      <div style={styles.right}>
        {selectMode && (
          <>
            {selectedCount > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {selectedCount} of {totalCount}
              </span>
            )}
            <button style={styles.viewBtn} onClick={selectedCount > 0 ? onDeselectAll : onSelectAll}>
              {selectedCount > 0 ? 'Deselect' : 'Select All'}
            </button>
            <button
              style={{ ...styles.viewBtn, opacity: selectedCount > 0 ? 1 : 0.4 }}
              onClick={onTrashSelected}
              disabled={selectedCount === 0}
              title="Move to Trash"
            >
              🗑 Trash
            </button>
          </>
        )}
        {isAdmin && (
          <button
            style={{ ...styles.viewBtn, ...(selectMode ? styles.viewBtnActive : undefined) }}
            onClick={onToggleSelectMode}
            title={selectMode ? 'Exit select mode' : 'Select photos'}
          >
            ☑ Select
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 30,
    background: 'var(--toolbar-bg)',
    borderTop: '1px solid var(--groove-light)',
    borderBottom: '1px solid var(--groove-dark)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 6px',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  navBtn: {
    background: 'var(--pale-slate)',
    borderTop: '2px solid var(--bevel-highlight)',
    borderLeft: '2px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-shadow)',
    borderRight: '2px solid var(--bevel-shadow)',
    borderRadius: 0,
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--carbon-black)',
    padding: '2px 8px',
  },
  viewBtn: {
    background: 'var(--pale-slate)',
    borderTop: '1px solid var(--bevel-highlight)',
    borderLeft: '1px solid var(--bevel-highlight)',
    borderBottom: '1px solid var(--bevel-shadow)',
    borderRight: '1px solid var(--bevel-shadow)',
    borderRadius: 0,
    cursor: 'pointer',
    fontSize: 11,
    color: 'var(--carbon-black)',
    padding: '2px 8px',
  },
  viewBtnActive: {
    background: 'var(--alabaster-grey)',
    borderTop: '1px solid var(--bevel-shadow)',
    borderLeft: '1px solid var(--bevel-shadow)',
    borderBottom: '1px solid var(--bevel-highlight)',
    borderRight: '1px solid var(--bevel-highlight)',
  },
};
