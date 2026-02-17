import { useCallback, useEffect, useState } from 'react'
import { skillsApi } from '../lib/api'
import { isModerator } from '../lib/roles'

type User = {
  id: string
  handle: string | null
  displayName: string | null
  role: string | null
  [key: string]: unknown
}

type CommentEntry = {
  id: string
  body: string
  userId: string
  createdAt: string
  userHandle: string | null
  userImage: string | null
  userDisplayName: string | null
}

type SkillCommentsPanelProps = {
  slug: string
  isAuthenticated: boolean
  me: User | null
}

export function SkillCommentsPanel({ slug, isAuthenticated, me }: SkillCommentsPanelProps) {
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [comments, setComments] = useState<CommentEntry[] | null>(null)

  const refresh = useCallback(() => {
    skillsApi
      .comments(slug)
      .then((r) => setComments(r.items))
      .catch(() => {})
  }, [slug])

  useEffect(() => {
    refresh()
  }, [refresh])

  const submitComment = async () => {
    const body = comment.trim()
    if (!body || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await skillsApi.addComment(slug, body)
      setComment('')
      refresh()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    if (deletingCommentId) return
    setDeleteError(null)
    setDeletingCommentId(commentId)
    try {
      await skillsApi.deleteComment(slug, commentId)
      refresh()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete comment')
    } finally {
      setDeletingCommentId(null)
    }
  }

  return (
    <div className="card">
      <h2 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
        Comments
      </h2>
      {isAuthenticated ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submitComment()
          }}
          className="comment-form"
        >
          <textarea
            className="comment-input"
            rows={4}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Leave a note…"
            disabled={isSubmitting}
          />
          {submitError ? <div className="report-dialog-error">{submitError}</div> : null}
          <button className="btn comment-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Posting…' : 'Post comment'}
          </button>
        </form>
      ) : (
        <p className="section-subtitle">Sign in to comment.</p>
      )}
      {deleteError ? <div className="report-dialog-error">{deleteError}</div> : null}
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {(comments ?? []).length === 0 ? (
          <div className="stat">No comments yet.</div>
        ) : (
          (comments ?? []).map((entry) => (
            <div key={entry.id} className="comment-item">
              <div className="comment-body">
                <strong>@{entry.userHandle ?? entry.userDisplayName ?? 'user'}</strong>
                <div className="comment-body-text">{entry.body}</div>
              </div>
              {isAuthenticated && me && (me.id === entry.userId || isModerator(me)) ? (
                <button
                  className="btn comment-delete"
                  type="button"
                  onClick={() => void deleteComment(entry.id)}
                  disabled={Boolean(deletingCommentId) || isSubmitting}
                >
                  {deletingCommentId === entry.id ? 'Deleting…' : 'Delete'}
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
