import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CommentItem } from '../../types';
import { getComments, postComment, deleteComment } from '../../api/client';
import { useSoundContext } from '../../contexts/SoundContext';

interface Props {
  photoSlug: string;
  commentCount: number;
  isAuthenticated: boolean;
  isAdmin: boolean;
  onLoginPrompt: () => void;
  onCommentsLoaded?: (comments: CommentItem[]) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommentSection({
  photoSlug,
  commentCount,
  isAuthenticated,
  isAdmin,
  onLoginPrompt,
  onCommentsLoaded,
}: Props) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState('');
  const sound = useSoundContext();

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getComments(photoSlug);
      setComments(res.results);
      onCommentsLoaded?.(res.results);
    } catch { /* */ }
    finally {
      setIsLoading(false);
      setLoaded(true);
    }
  }, [photoSlug, onCommentsLoaded]);

  // Reset when photo changes
  useEffect(() => {
    setLoaded(false);
    setComments([]);
  }, [photoSlug]);

  // Load comments when section first appears (or after reset)
  useEffect(() => {
    if (!loaded) loadComments();
  }, [loaded, loadComments]);

  const handlePost = useCallback(async () => {
    if (!text.trim()) return;
    setIsPosting(true);
    setError('');
    try {
      const newComment = await postComment(photoSlug, text.trim());
      setComments(prev => [newComment, ...prev]);
      setText('');
      sound.play('comment');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to post';
      if (msg.includes('429')) {
        setError('Slow down — too many comments.');
      } else {
        setError('Failed to post comment.');
      }
    } finally {
      setIsPosting(false);
    }
  }, [text, photoSlug, sound]);

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      await deleteComment(photoSlug, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch { /* */ }
  }, [photoSlug]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerText}>
          Comments{commentCount > 0 || comments.length > 0
            ? ` (${comments.length || commentCount})`
            : ''}
        </span>
      </div>

      {isAuthenticated ? (
        <div style={styles.inputRow}>
          <textarea
            style={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            disabled={isPosting}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePost();
              }
            }}
          />
          <button
            style={{ ...styles.postBtn, opacity: text.trim() && !isPosting ? 1 : 0.4 }}
            onClick={handlePost}
            disabled={!text.trim() || isPosting}
          >
            {isPosting ? '...' : 'Post'}
          </button>
        </div>
      ) : (
        <button style={styles.signInLink} onClick={onLoginPrompt}>
          Sign in to comment
        </button>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            style={styles.error}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && !loaded && (
        <div style={{ padding: 8, fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>
      )}

      {loaded && comments.length === 0 && (
        <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-muted)' }}>
          No comments yet
        </div>
      )}

      <div style={styles.list}>
        <AnimatePresence initial={false}>
          {comments.map(comment => (
            <motion.div
              key={comment.id}
              style={styles.comment}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <div style={styles.commentHeader}>
                <span style={styles.author}>{comment.display_name}</span>
                <span style={styles.time}>{timeAgo(comment.created_at)}</span>
                {isAdmin && (
                  <button
                    style={styles.deleteBtn}
                    onClick={() => handleDelete(comment.id)}
                    title="Delete comment"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p style={styles.commentText}>{comment.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 10,
  },
  header: {
    marginBottom: 6,
  },
  headerText: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  inputRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  textarea: {
    flex: 1,
    fontSize: 13,
    padding: '6px 8px',
    borderTop: '2px solid var(--bevel-shadow)',
    borderLeft: '2px solid var(--bevel-shadow)',
    borderBottom: '2px solid var(--bevel-highlight)',
    borderRight: '2px solid var(--bevel-highlight)',
    borderRadius: 0,
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    background: 'var(--inset-bg)',
  },
  postBtn: {
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 12px',
    borderTop: '2px solid var(--bevel-highlight)',
    borderLeft: '2px solid var(--bevel-highlight)',
    borderBottom: '2px solid var(--bevel-shadow)',
    borderRight: '2px solid var(--bevel-shadow)',
    borderRadius: 0,
    background: 'var(--pale-slate)',
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
  signInLink: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '4px 0',
    marginBottom: 8,
  },
  error: {
    fontSize: 12,
    color: '#d32f2f',
    padding: '2px 0 4px',
    overflow: 'hidden',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  comment: {
    padding: '6px 8px',
    borderRadius: 0,
    background: 'var(--platinum)',
    borderTop: '1px solid var(--bevel-shadow)',
    borderLeft: '1px solid var(--bevel-shadow)',
    borderBottom: '1px solid var(--bevel-highlight)',
    borderRight: '1px solid var(--bevel-highlight)',
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  author: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  time: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  deleteBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    color: '#999',
    padding: '0 2px',
  },
  commentText: {
    fontSize: 13,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
};
