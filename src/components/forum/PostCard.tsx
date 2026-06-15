"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getIssueTagLabel } from "@/lib/constants/issue-tags";
import { IssueTagChipPicker } from "@/components/forum/IssueTagChipPicker";
import { LinkifiedText } from "@/components/forum/LinkifiedText";
import { formatRelativeTime } from "@/lib/forum/format-time";
import type { ForumComment, ForumPost } from "@/lib/types/forum";

type PostEditInput = {
  title: string;
  body: string;
  issueSlugs: string[];
};

interface PostCardProps {
  post: ForumPost;
  signedIn: boolean;
  currentUserId: string | null;
  issueTags: string[];
  onVote: (postId: string, direction: 1 | -1) => Promise<void>;
  onLoadComments: (postId: string) => Promise<ForumComment[]>;
  onAddComment: (postId: string, body: string) => Promise<void>;
  onEditPost: (postId: string, input: PostEditInput) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
}

export function PostCard({
  post,
  signedIn,
  currentUserId,
  issueTags,
  onVote,
  onLoadComments,
  onAddComment,
  onEditPost,
  onDeletePost,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editBody, setEditBody] = useState(post.body);
  const [editIssueSlugs, setEditIssueSlugs] = useState<string[]>(post.issueSlugs);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwner = currentUserId === post.authorId;

  const openComments = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (comments.length > 0) return;
    setLoadingComments(true);
    try {
      const loaded = await onLoadComments(post.id);
      setComments(loaded);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmittingComment(true);
    try {
      await onAddComment(post.id, commentBody.trim());
      const loaded = await onLoadComments(post.id);
      setComments(loaded);
      setCommentBody("");
    } finally {
      setSubmittingComment(false);
    }
  };

  const startEditing = () => {
    setEditTitle(post.title);
    setEditBody(post.body);
    setEditIssueSlugs(post.issueSlugs);
    setActionError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setActionError(null);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || !editBody.trim()) {
      setActionError("Title and body are required.");
      return;
    }
    setSavingEdit(true);
    setActionError(null);
    try {
      await onEditPost(post.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
        issueSlugs: editIssueSlugs,
      });
      setEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Delete this post? This cannot be undone and will remove all comments and votes.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      await onDeletePost(post.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete post");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex gap-3 p-4">
        <div className="flex w-10 shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            aria-label="Upvote"
            disabled={!signedIn || editing}
            onClick={() => onVote(post.id, 1)}
            className={`rounded px-1 text-lg leading-none ${
              post.userVote === 1
                ? "text-orange-600"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            ▲
          </button>
          <span className="text-sm font-semibold tabular-nums">{post.score}</span>
          <button
            type="button"
            aria-label="Downvote"
            disabled={!signedIn || editing}
            onClick={() => onVote(post.id, -1)}
            className={`rounded px-1 text-lg leading-none ${
              post.userVote === -1
                ? "text-indigo-600"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            ▼
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {post.authorUsername}
            </span>
            <span>·</span>
            <time dateTime={post.createdAt}>{formatRelativeTime(post.createdAt)}</time>
            {post.edited && (
              <>
                <span>·</span>
                <span className="italic text-slate-400">edited</span>
              </>
            )}
            {!editing &&
              post.issueSlugs.map((slug) => (
                <span
                  key={slug}
                  className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800"
                >
                  {getIssueTagLabel(slug)}
                </span>
              ))}
            {isOwner && !editing && (
              <span className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </span>
            )}
          </div>

          {editing ? (
            <form onSubmit={submitEdit} className="mt-3 space-y-3">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
                placeholder="Title"
              />
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                rows={4}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                maxLength={5000}
              />
              <IssueTagChipPicker
                label="Issue tags (optional)"
                hint="Select one or more issues for this discussion."
                availableSlugs={issueTags}
                selectedSlugs={editIssueSlugs}
                onChange={setEditIssueSlugs}
              />
              {actionError && <p className="text-sm text-red-600">{actionError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelEditing}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                {post.title}
              </h3>
              <LinkifiedText
                text={post.body}
                className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300"
              />
              <button
                type="button"
                onClick={openComments}
                className="mt-3 text-sm text-slate-500 hover:text-slate-800"
              >
                {expanded
                  ? "Hide comments"
                  : `${post.commentCount} comment${post.commentCount === 1 ? "" : "s"}`}
              </button>
            </>
          )}

          {actionError && !editing && (
            <p className="mt-2 text-sm text-red-600">{actionError}</p>
          )}
        </div>
      </div>

      {expanded && !editing && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          {loadingComments ? (
            <p className="text-sm text-slate-500">Loading comments…</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {c.authorUsername}
                  </span>
                  <span className="text-slate-400">
                    {" "}
                    · {formatRelativeTime(c.createdAt)}
                  </span>
                  <LinkifiedText
                    text={c.body}
                    className="mt-1 text-sm text-slate-700 dark:text-slate-300"
                  />
                </li>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-slate-500">No comments yet.</p>
              )}
            </ul>
          )}
          {signedIn ? (
            <form onSubmit={submitComment} className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                placeholder="Add a comment…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={2000}
              />
              <Button type="submit" disabled={submittingComment}>
                Reply
              </Button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              <Link href="/auth?next=/forum" className="underline">
                Sign in
              </Link>{" "}
              to comment.
            </p>
          )}
        </div>
      )}
    </article>
  );
}
