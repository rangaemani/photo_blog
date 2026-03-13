import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type {
  PhotoDetail as PhotoDetailType,
  ContextMenuState,
} from "../../types";
import { drawBlurhash } from "../../utils/blurhash";
import ExifCard from "./ExifCard";
import InteractionBar from "./InteractionBar";
import CommentSection from "./CommentSection";
import {
  createContextMenuHandler,
  type ContextMenuOption,
} from "../../utils/contextMenu";
import { trashPhotos } from "../../api/client";

interface Props {
  photo: PhotoDetailType | null;
  isLoading: boolean;
  onContextMenu?: (menu: ContextMenuState) => void;
  selectable?: boolean;
  onTrashed?: () => void;
  isAuthenticated?: boolean;
  onLoginPrompt?: () => void;
}

export default function PhotoDetail({
  photo,
  isLoading,
  onContextMenu,
  selectable,
  onTrashed,
  isAuthenticated = false,
  onLoginPrompt,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [originalLoaded, setOriginalLoaded] = useState(false);
  const [reactionSummary, setReactionSummary] = useState<Record<string, number>>({});
  const [userReactions, setUserReactions] = useState<string[]>([]);

  // Sync reaction state from photo prop
  useEffect(() => {
    if (photo) {
      setReactionSummary(photo.reaction_summary ?? {});
      setUserReactions(photo.user_reactions ?? []);
    }
  }, [photo]);

  const handleReactionChange = useCallback((summary: Record<string, number>, reactions: string[]) => {
    setReactionSummary(summary);
    setUserReactions(reactions);
  }, []);

  useEffect(() => {
    if (canvasRef.current && photo?.blurhash) {
      try {
        drawBlurhash(
          canvasRef.current,
          photo.blurhash,
          photo.width,
          photo.height,
        );
      } catch {
        /* ignore */
      }
    }
  }, [photo?.blurhash, photo?.width, photo?.height]);

  useEffect(() => {
    setThumbLoaded(false);
    setOriginalLoaded(false);
  }, [photo?.slug]);

  const handleContext = useMemo(() => {
    if (!photo || !onContextMenu) return undefined;
    const options: ContextMenuOption[] = [
      {
        label: "View Original",
        action: () =>
          window.open(
            photo.thumbnail_url.replace("/thumbnails/", "/originals/").replace(".webp", ".jpg"),
            "_blank",
          ),
      },
      {
        label: "Copy Image URL",
        action: () => navigator.clipboard.writeText(photo.thumbnail_url),
      },
      { label: "", divider: true, visible: selectable },
      {
        label: "Move to Trash",
        action: () => { trashPhotos([photo.id]).then(() => onTrashed?.()); },
        visible: selectable,
      },
    ];
    return createContextMenuHandler(options, onContextMenu);
  }, [photo, selectable, onTrashed, onContextMenu]);

  if (isLoading || !photo) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Image area — grows to fill remaining space, shrinks to make room for metadata */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          padding: "12px 16px 0",
        }}
      >
        {/* Stacked layers share the same grid cell; object-fit:contain keeps aspect ratio */}
        <div
          onContextMenu={handleContext}
          style={{ position: "relative", width: "100%", height: "100%" }}
        >
          {/* Phase 1: Blurhash */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: thumbLoaded ? 0 : 1,
              transition: "opacity 200ms",
            }}
          />
          {/* Phase 2: Thumbnail */}
          <img
            src={photo.thumbnail_url}
            alt=""
            onLoad={() => setThumbLoaded(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: thumbLoaded && !originalLoaded ? 1 : 0,
              transition: "opacity 200ms",
            }}
          />
          {/* Phase 3: Original */}
          <img
            src={photo.original_url}
            alt={photo.title}
            onLoad={() => setOriginalLoaded(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              opacity: originalLoaded ? 1 : 0,
              transition: "opacity 200ms",              
              
            }}
          />
        </div>
      </div>

      {/* Metadata — fixed strip below image, scrolls internally if tall */}
      <div
        style={{
          flexShrink: 0,
          padding: "10px 16px 14px",
          overflowY: "auto",
          maxHeight: "40%",
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {photo.title}
        </h2>
        {photo.description && (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              marginTop: 6,
              lineHeight: 1.5,
              marginBottom: 0,
            }}
          >
            {photo.description}
          </p>
        )}
        <InteractionBar
          photoSlug={photo.slug}
          reactionSummary={reactionSummary}
          userReactions={userReactions}
          isAuthenticated={isAuthenticated}
          onLoginPrompt={onLoginPrompt ?? (() => {})}
          onReactionChange={handleReactionChange}
        />
        <CommentSection
          photoSlug={photo.slug}
          commentCount={photo.comment_count ?? 0}
          isAuthenticated={isAuthenticated}
          isAdmin={selectable ?? false}
          onLoginPrompt={onLoginPrompt ?? (() => {})}
        />
        <ExifCard photo={photo} />
      </div>
    </div>
  );
}
