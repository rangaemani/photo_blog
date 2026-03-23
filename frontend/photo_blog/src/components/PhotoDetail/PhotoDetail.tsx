import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type {
  PhotoDetail as PhotoDetailType,
  ContextMenuState,
  TagItem,
  PopTagItem,
} from "../../types";
import { drawBlurhash } from "../../utils/blurhash";
import ExifStrip from "./ExifStrip";
import InteractionBar from "./InteractionBar";
import TagBar from "./TagBar";
import PopTagOverlay from "./PopTagOverlay";
import CommentSection from "./CommentSection";
import {
  createContextMenuHandler,
  type ContextMenuOption,
} from "../../utils/contextMenu";
import { trashPhotos } from "../../api/client";

const MAT_SIDE = 28;
const MAT_TOP = 28;
const GALLERY_BG = "#f0ede8";
const GALLERY_PAD = 16;
const SIDE_PANEL_W = 260;
const WINDOW_TITLE_H = 28;
const EXIF_H = 43; // approximate ExifStrip height (separator + 2 rows)
const MAT_CHROME_H = MAT_TOP + EXIF_H + 10; // mat top + exif strip + bottom spacer

interface Props {
  photo: PhotoDetailType | null;
  isLoading: boolean;
  onContextMenu?: (menu: ContextMenuState) => void;
  selectable?: boolean;
  onTrashed?: () => void;
  isAuthenticated?: boolean;
  currentUsername?: string;
  onLoginPrompt?: () => void;
  windowWidth?: number;
  windowHeight?: number;
}

export default function PhotoDetail({
  photo,
  isLoading,
  onContextMenu,
  selectable,
  onTrashed,
  isAuthenticated = false,
  currentUsername,
  onLoginPrompt,
  windowWidth = 640,
  windowHeight = 480,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loginPrompt = useCallback(onLoginPrompt ?? (() => {}), [onLoginPrompt]); // stable fallback
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [originalLoaded, setOriginalLoaded] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<Record<string, number>>({});
  const [userReactions, setUserReactions] = useState<string[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [popTags, setPopTags] = useState<PopTagItem[]>([]);

  useEffect(() => {
    if (photo) {
      setReactionSummary(photo.reaction_summary ?? {});
      setUserReactions(photo.user_reactions ?? []);
      setTags(photo.tags ?? []);
      setPopTags(photo.pop_tags ?? []);
    }
  }, [photo]);

  const handleReactionChange = useCallback((summary: Record<string, number>, reactions: string[]) => {
    setReactionSummary(summary);
    setUserReactions(reactions);
  }, []);

  useEffect(() => {
    if (canvasRef.current && photo?.blurhash) {
      try { drawBlurhash(canvasRef.current, photo.blurhash, photo.width, photo.height); }
      catch { /* ignore */ }
    }
  }, [photo?.blurhash, photo?.width, photo?.height]);

  useEffect(() => {
    setThumbLoaded(false);
    setOriginalLoaded(false);
  }, [photo?.slug]);


  const handleContext = useMemo(() => {
    if (!photo || !onContextMenu) return undefined;
    const options: ContextMenuOption[] = [
      { label: "View Original", action: () => window.open(photo.thumbnail_url.replace("/thumbnails/", "/originals/").replace(".webp", ".jpg"), "_blank") },
      { label: "Copy Image URL", action: () => navigator.clipboard.writeText(photo.thumbnail_url) },
      { label: "", divider: true, visible: selectable },
      { label: "Move to Trash", action: () => { trashPhotos([photo.id]).then(() => onTrashed?.()); }, visible: selectable },
    ];
    return createContextMenuHandler(options, onContextMenu);
  }, [photo, selectable, onTrashed, onContextMenu]);

  if (isLoading || !photo) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", background: GALLERY_BG }}>
        Loading...
      </div>
    );
  }

  const aspect = photo.width / photo.height;
  const isWideMode = windowWidth >= 700;

  // Compute image dimensions using object-fit:contain logic (wide mode only)
  let imgW: number | undefined;
  let imgH: number | undefined;
  if (isWideMode) {
    const galW = windowWidth - SIDE_PANEL_W - GALLERY_PAD * 2;
    const galH = windowHeight - WINDOW_TITLE_H - GALLERY_PAD * 2;
    const maxImgW = Math.max(100, galW - MAT_SIDE * 2);
    const maxImgH = Math.max(100, galH - MAT_CHROME_H);
    if (maxImgW / maxImgH >= aspect) {
      imgH = maxImgH;
      imgW = imgH * aspect;
    } else {
      imgW = maxImgW;
      imgH = imgW / aspect;
    }
  }

  const imageStack = (
    <>
      <canvas
        ref={canvasRef}
        style={{ ...styles.imgLayer, opacity: thumbLoaded || originalLoaded ? 0 : 1, transition: "opacity 200ms" }}
      />
      <img
        src={photo.thumbnail_url}
        alt=""
        onLoad={() => setThumbLoaded(true)}
        style={{ ...styles.imgLayer, objectFit: "cover", opacity: thumbLoaded && !originalLoaded ? 1 : 0, transition: "opacity 200ms" }}
      />
      <img
        src={photo.original_url}
        alt={photo.title}
        onLoad={() => setOriginalLoaded(true)}
        style={{ ...styles.imgLayer, objectFit: "cover", opacity: originalLoaded ? 1 : 0, transition: "opacity 200ms" }}
      />
      <PopTagOverlay
        photoSlug={photo.slug}
        popTags={popTags}
        isAuthenticated={isAuthenticated}
        isAdmin={selectable ?? false}
        currentUsername={currentUsername}
        onLoginPrompt={loginPrompt}
        onPopTagsChange={setPopTags}
      />
    </>
  );

  const socialSection = (
    <>
      <TagBar
        photoSlug={photo.slug}
        tags={tags}
        isAuthenticated={isAuthenticated}
        isAdmin={selectable ?? false}
        currentUsername={currentUsername}
        onLoginPrompt={loginPrompt}
        onTagsChange={setTags}
      />
      <InteractionBar
        photoSlug={photo.slug}
        reactionSummary={reactionSummary}
        userReactions={userReactions}
        isAuthenticated={isAuthenticated}
        onLoginPrompt={loginPrompt}
        onReactionChange={handleReactionChange}
      />
      <CommentSection
        photoSlug={photo.slug}
        commentCount={photo.comment_count ?? 0}
        isAuthenticated={isAuthenticated}
        isAdmin={selectable ?? false}
        onLoginPrompt={loginPrompt}
      />
    </>
  );

  const metaPanel = (
    <div style={styles.meta}>
      <h2 style={styles.title}>{photo.title}.{photo.original_url.split('.').pop()}</h2>
      {photo.description && <p style={styles.description}>{photo.description}</p>}
      {!isWideMode && <ExifStrip photo={photo} />}
      {socialSection}
    </div>
  );

  const framedPhoto = (
    <div style={styles.gallery}>
      <div style={styles.frameWrap}>
        <div style={styles.frame}>
          <div style={{ ...styles.imageArea, ...(imgW ? { width: imgW, height: imgH } : { aspectRatio: `${aspect}` }) }} onContextMenu={handleContext}>
            <div style={styles.fillet} />
            {imageStack}
          </div>
          <ExifStrip photo={photo} padded />
          <div style={{ height: 10 }} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.outer}>
      {isWideMode ? (
        /* Wide mode: photo left column, scrollable meta right */
        <div style={styles.wide}>
          {framedPhoto}
          <div style={styles.sidePanel}>
            <h2 style={styles.title}>{photo.title}.{photo.original_url.split('.').pop()}</h2>
            {photo.description && <p style={styles.description}>{photo.description}</p>}
            {socialSection}
          </div>
        </div>
      ) : (
        <>
          {/* Compact mode: image fills area, no mat */}
          <div style={styles.compactImage} onContextMenu={handleContext}>
            {imageStack}
          </div>
          {metaPanel}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outer: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  gallery: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    background: GALLERY_BG,
    overflow: "hidden",
  },
  frameWrap: {
    maxWidth: "100%",
    maxHeight: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
  },
  frame: {
    display: "flex",
    flexDirection: "column",
    background: "#fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.10), 0 8px 24px rgba(0,0,0,0.07)",
    maxWidth: "100%",
    maxHeight: "100%",
    overflow: "hidden",
  },
  imageArea: {
    position: "relative",
    margin: `${MAT_TOP}px ${MAT_SIDE}px 0`,
    maxWidth: "100%",
    overflow: "hidden",
    userSelect: "none",
  },
  fillet: {
    position: "absolute",
    inset: 0,
    border: "1px solid #e0dcd4",
    zIndex: 6,
    pointerEvents: "none",
  },
  imgLayer: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  wide: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
  },
  sidePanel: {
    width: 260,
    flexShrink: 0,
    borderLeft: "1px solid var(--window-border)",
    overflowY: "auto",
    padding: "12px 16px 16px",
  },
  compactImage: {
    position: "relative" as const,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  meta: {
    flexShrink: 0,
    padding: "10px 16px 14px",
    overflowY: "auto",
    maxHeight: "40%",
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--text-primary)",
    margin: 0,
  },
  description: {
    fontSize: 13,
    color: "var(--text-secondary)",
    marginTop: 6,
    lineHeight: 1.5,
    marginBottom: 0,
  },
};
